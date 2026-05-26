import type { SqliteDatabase } from "@db/client";
import type { IIssueRepo } from "@db/types/repo";
import type {
  AgentSessionRow,
  IssueDetailCommentRow,
  IssueDetailRow,
  IssueDetailRunAttemptRow,
  IssueDetailSessionRow,
  IssueRow,
  IssuesByWorkflowStateColumn,
  RunAttemptRow,
  WorkflowStateCategory,
  WorkflowStateRow,
} from "@db/types/domain";

export class IssueRepo implements IIssueRepo {
  constructor(private readonly db: SqliteDatabase) {}

  createIssue(input: IssueRow): void {
    this.db
      .prepare(
        `INSERT INTO issues (id, project_id, workflow_state_id, identifier, title, description, priority)
         VALUES (@id, @projectId, @workflowStateId, @identifier, @title, @description, @priority)`,
      )
      .run(input);
  }

  updateIssueState(issueId: string, workflowStateId: string): void {
    this.db
      .prepare(`UPDATE issues SET workflow_state_id = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(workflowStateId, issueId);
  }

  updateIssue(
    issueId: string,
    input: { title?: string; description?: string | null; priority?: number | null },
  ): void {
    const sets = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    if (input.title !== undefined) {
      sets.push("title = ?");
      params.push(input.title);
    }
    if (input.description !== undefined) {
      sets.push("description = ?");
      params.push(input.description);
    }
    if (input.priority !== undefined) {
      sets.push("priority = ?");
      params.push(input.priority);
    }

    if (sets.length === 1) {
      return;
    }

    params.push(issueId);
    this.db.prepare(`UPDATE issues SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }

  setIssueAssignee(issueId: string, assigneeId: string | null): void {
    this.db
      .prepare(`UPDATE issues SET assignee_id = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(assigneeId, issueId);
  }

  listIssuesByStateCategories(projectId: string, categories: WorkflowStateCategory[]): IssueRow[] {
    if (categories.length === 0) return [];
    const placeholders = categories.map(() => "?").join(", ");
    return this.db
      .prepare(
        `SELECT i.id, i.project_id as projectId, i.workflow_state_id as workflowStateId,
                i.identifier, i.title, i.description, i.priority
         FROM issues i
         JOIN workflow_states ws ON ws.id = i.workflow_state_id
         WHERE i.project_id = ?
           AND ws.category IN (${placeholders})
         ORDER BY COALESCE(i.priority, 999) ASC, i.updated_at ASC`,
      )
      .all(projectId, ...categories) as IssueRow[];
  }

  getIssueById(issueId: string): IssueRow | null {
    return (
      (this.db
        .prepare(
          `SELECT id, project_id as projectId, workflow_state_id as workflowStateId,
                  identifier, title, description, priority
           FROM issues WHERE id = ?`,
        )
        .get(issueId) as IssueRow | undefined) ?? null
    );
  }

  listIssuesGroupedByWorkflowState(projectId: string): IssuesByWorkflowStateColumn[] {
    const states = this.db
      .prepare(
        `SELECT id, project_id as projectId, name, category, position
         FROM workflow_states
         WHERE project_id = ?
         ORDER BY position ASC`,
      )
      .all(projectId) as WorkflowStateRow[];

    if (states.length === 0) {
      return [];
    }

    const issues = this.db
      .prepare(
        `SELECT i.id, i.project_id as projectId, i.workflow_state_id as workflowStateId,
                i.identifier, i.title, i.description, i.priority
         FROM issues i
         JOIN workflow_states ws ON ws.id = i.workflow_state_id
         WHERE i.project_id = ?
         ORDER BY ws.position ASC, COALESCE(i.priority, 999) ASC, i.updated_at ASC`,
      )
      .all(projectId) as IssueRow[];

    const issuesByState = new Map<string, IssueRow[]>();
    for (const state of states) {
      issuesByState.set(state.id, []);
    }

    for (const issue of issues) {
      const bucket = issuesByState.get(issue.workflowStateId);
      if (bucket) {
        bucket.push(issue);
      }
    }

    return states.map((state) => ({
      workflowStateId: state.id,
      workflowStateName: state.name,
      category: state.category,
      position: state.position,
      issues: issuesByState.get(state.id) ?? [],
    }));
  }

  getIssueDetail(issueId: string, attemptLimit = 20): IssueDetailRow | null {
    const issue = this.db
      .prepare(
        `SELECT i.id as issueId,
                i.project_id as projectId,
                i.identifier,
                i.title,
                i.description,
                i.priority,
                i.workflow_state_id as workflowStateId,
                ws.name as workflowStateName
         FROM issues i
         JOIN workflow_states ws ON ws.id = i.workflow_state_id
         WHERE i.id = ?`,
      )
      .get(issueId) as
      | {
          issueId: string;
          projectId: string;
          identifier: string;
          title: string;
          description: string | null;
          priority: number | null;
          workflowStateId: string;
          workflowStateName: string;
        }
      | undefined;

    if (!issue) {
      return null;
    }

    const comments = this.db
      .prepare(
        `SELECT id, body, author_id as authorId, created_at as createdAt
         FROM issue_comments
         WHERE issue_id = ?
         ORDER BY created_at ASC`,
      )
      .all(issueId) as IssueDetailCommentRow[];

    const cap = Math.max(1, Math.min(200, Math.floor(attemptLimit)));
    const attempts = this.db
      .prepare(
        `SELECT id, issue_id as issueId, attempt_number as attemptNumber, status,
                started_at as startedAt, finished_at as finishedAt, error_message as errorMessage
         FROM run_attempts
         WHERE issue_id = ?
         ORDER BY started_at DESC
         LIMIT ?`,
      )
      .all(issueId, cap) as RunAttemptRow[];

    const sessionsByAttempt = new Map<string, IssueDetailSessionRow[]>();
    if (attempts.length > 0) {
      const placeholders = attempts.map(() => "?").join(", ");
      const sessions = this.db
        .prepare(
          `SELECT id, run_attempt_id as runAttemptId, runtime_kind as runtimeKind,
                  session_ref as sessionRef, status, started_at as startedAt, finished_at as finishedAt
           FROM agent_sessions
           WHERE run_attempt_id IN (${placeholders})
           ORDER BY started_at ASC`,
        )
        .all(...attempts.map((attempt) => attempt.id)) as AgentSessionRow[];

      for (const attempt of attempts) {
        sessionsByAttempt.set(attempt.id, []);
      }

      for (const session of sessions) {
        const bucket = sessionsByAttempt.get(session.runAttemptId);
        if (!bucket) {
          continue;
        }
        bucket.push({
          sessionId: session.id,
          runtimeKind: session.runtimeKind,
          sessionRef: session.sessionRef,
          status: session.status,
          startedAt: session.startedAt,
          finishedAt: session.finishedAt,
        });
      }
    }

    const attemptRows: IssueDetailRunAttemptRow[] = attempts.map((attempt) => ({
      runAttemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      errorMessage: attempt.errorMessage,
      sessions: sessionsByAttempt.get(attempt.id) ?? [],
    }));

    return {
      issueId: issue.issueId,
      projectId: issue.projectId,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      workflowStateId: issue.workflowStateId,
      workflowStateName: issue.workflowStateName,
      comments,
      attempts: attemptRows,
    };
  }
}

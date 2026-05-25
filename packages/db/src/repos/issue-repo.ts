import type { SqliteDatabase } from "@db/client";
import type { IIssueRepo } from "@db/types/repo";
import type { IssueRow, WorkflowStateCategory } from "@db/types/domain";

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
}

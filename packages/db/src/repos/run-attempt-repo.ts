import type { SqliteDatabase } from "@db/client";
import type { IRunAttemptRepo } from "@db/types/repo";
import type { RunAttemptRow, RunAttemptStatus, RecentFinishedRunSnapshotRow, RunningRunSnapshotRow } from "@db/types/domain";

export class RunAttemptRepo implements IRunAttemptRepo {
  constructor(private readonly db: SqliteDatabase) {}

  createRunAttempt(input: {
    id: string;
    issueId: string;
    attemptNumber: number;
    status: RunAttemptStatus;
    errorMessage?: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO run_attempts (id, issue_id, attempt_number, status, error_message)
         VALUES (@id, @issueId, @attemptNumber, @status, @errorMessage)`,
      )
      .run({ ...input, errorMessage: input.errorMessage ?? null });
  }

  updateRunAttemptStatus(
    runAttemptId: string,
    status: RunAttemptStatus,
    errorMessage?: string | null,
  ): void {
    this.db
      .prepare(
        `UPDATE run_attempts
         SET status = ?, error_message = ?, finished_at = CASE WHEN ? = 'running' THEN NULL ELSE datetime('now') END
         WHERE id = ?`,
      )
      .run(status, errorMessage ?? null, status, runAttemptId);
  }

  getLatestRunAttempt(issueId: string): RunAttemptRow | null {
    return (
      (this.db
        .prepare(
          `SELECT id, issue_id as issueId, attempt_number as attemptNumber, status,
                  started_at as startedAt, finished_at as finishedAt, error_message as errorMessage
           FROM run_attempts
           WHERE issue_id = ?
           ORDER BY started_at DESC
           LIMIT 1`,
        )
        .get(issueId) as RunAttemptRow | undefined) ?? null
    );
  }

  listRunningRunAttempts(projectId: string): RunAttemptRow[] {
    return this.db
      .prepare(
        `SELECT r.id, r.issue_id as issueId, r.attempt_number as attemptNumber, r.status,
                r.started_at as startedAt, r.finished_at as finishedAt, r.error_message as errorMessage
         FROM run_attempts r
         JOIN issues i ON i.id = r.issue_id
         WHERE i.project_id = ? AND r.status = 'running'
         ORDER BY r.started_at ASC`,
      )
      .all(projectId) as RunAttemptRow[];
  }

  listRunningRunSnapshots(projectId: string): RunningRunSnapshotRow[] {
    return this.db
      .prepare(
        `SELECT r.id as runAttemptId,
                r.issue_id as issueId,
                i.identifier as identifier,
                r.attempt_number as attemptNumber,
                r.started_at as startedAt,
                s.id as sessionId,
                s.status as sessionStatus
         FROM run_attempts r
         JOIN issues i ON i.id = r.issue_id
         LEFT JOIN agent_sessions s ON s.id = (
           SELECT id
           FROM agent_sessions
           WHERE run_attempt_id = r.id AND status = 'running'
           ORDER BY started_at DESC
           LIMIT 1
         )
         WHERE i.project_id = ? AND r.status = 'running'
         ORDER BY r.started_at ASC`,
      )
      .all(projectId) as RunningRunSnapshotRow[];
  }

  listRecentFinishedRunSnapshots(projectId: string, limit = 20): RecentFinishedRunSnapshotRow[] {
    const cap = Math.max(1, Math.min(200, Math.floor(limit)));
    return this.db
      .prepare(
        `SELECT r.id as runAttemptId,
                r.issue_id as issueId,
                i.identifier as identifier,
                r.attempt_number as attemptNumber,
                r.status as status,
                r.finished_at as finishedAt,
                r.error_message as errorMessage
         FROM run_attempts r
         JOIN issues i ON i.id = r.issue_id
         WHERE i.project_id = ?
           AND r.status != 'running'
           AND r.finished_at IS NOT NULL
         ORDER BY r.finished_at DESC
         LIMIT ?`,
      )
      .all(projectId, cap) as RecentFinishedRunSnapshotRow[];
  }

  listRunAttemptsByIssue(issueId: string, limit = 20): RunAttemptRow[] {
    const cap = Math.max(1, Math.min(200, Math.floor(limit)));
    return this.db
      .prepare(
        `SELECT id, issue_id as issueId, attempt_number as attemptNumber, status,
                started_at as startedAt, finished_at as finishedAt, error_message as errorMessage
         FROM run_attempts
         WHERE issue_id = ?
         ORDER BY started_at DESC
         LIMIT ?`,
      )
      .all(issueId, cap) as RunAttemptRow[];
  }
}

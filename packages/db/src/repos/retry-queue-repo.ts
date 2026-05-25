import type { SqliteDatabase } from "@db/client";
import type { IRetryQueueRepo } from "@db/types/repo";
import type { RetryQueueRow } from "@db/types/domain";

export class RetryQueueRepo implements IRetryQueueRepo {
  constructor(private readonly db: SqliteDatabase) {}

  upsertRetry(input: RetryQueueRow): void {
    this.db
      .prepare(
        `INSERT INTO retry_queue (issue_id, attempt_number, due_at, error_message)
         VALUES (@issueId, @attemptNumber, @dueAt, @errorMessage)
         ON CONFLICT(issue_id) DO UPDATE SET
           attempt_number = excluded.attempt_number,
           due_at = excluded.due_at,
           error_message = excluded.error_message,
           updated_at = datetime('now')`,
      )
      .run({ ...input, errorMessage: input.errorMessage ?? null });
  }

  removeRetry(issueId: string): void {
    this.db.prepare("DELETE FROM retry_queue WHERE issue_id = ?").run(issueId);
  }

  getRetry(issueId: string): RetryQueueRow | null {
    return (
      (this.db
        .prepare(
          `SELECT issue_id as issueId, attempt_number as attemptNumber, due_at as dueAt, error_message as errorMessage
           FROM retry_queue WHERE issue_id = ?`,
        )
        .get(issueId) as RetryQueueRow | undefined) ?? null
    );
  }

  listDueRetries(nowIso: string): RetryQueueRow[] {
    return this.db
      .prepare(
        `SELECT issue_id as issueId, attempt_number as attemptNumber, due_at as dueAt, error_message as errorMessage
         FROM retry_queue
         WHERE due_at <= ?
         ORDER BY due_at ASC`,
      )
      .all(nowIso) as RetryQueueRow[];
  }

  listRetries(): RetryQueueRow[] {
    return this.db
      .prepare(
        `SELECT issue_id as issueId, attempt_number as attemptNumber, due_at as dueAt, error_message as errorMessage
         FROM retry_queue
         ORDER BY due_at ASC`,
      )
      .all() as RetryQueueRow[];
  }
}

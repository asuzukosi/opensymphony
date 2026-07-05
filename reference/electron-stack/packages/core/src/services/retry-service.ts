import type { IRetryQueueRepo } from "@symphony/db";
import type { ScheduleRetryInput } from "@core/types/orchestrator";

export class RetryService {
  constructor(private readonly retryQueue: IRetryQueueRepo) {}

  scheduleRetry(input: ScheduleRetryInput): { dueAt: string; delayMs: number } {
    const exp = Math.max(0, input.attemptNumber - 1);
    const delayMs = Math.min(input.maxDelayMs, input.baseDelayMs * 2 ** exp);
    const dueAt = new Date(Date.now() + delayMs).toISOString();

    this.retryQueue.upsertRetry({
      issueId: input.issueId,
      attemptNumber: input.attemptNumber,
      dueAt,
      errorMessage: input.errorMessage ?? null,
    });

    return { dueAt, delayMs };
  }

  popDueRetries(
    nowIso: string,
  ): Array<{ issueId: string; attemptNumber: number; errorMessage: string | null }> {
    const due = this.retryQueue.listDueRetries(nowIso);
    for (const row of due) {
      this.retryQueue.removeRetry(row.issueId);
    }
    return due.map((row) => ({
      issueId: row.issueId,
      attemptNumber: row.attemptNumber,
      errorMessage: row.errorMessage,
    }));
  }
}

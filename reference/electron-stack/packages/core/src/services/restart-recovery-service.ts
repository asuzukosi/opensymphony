import type { IAgentSessionRepo, IRetryQueueRepo, IRunAttemptRepo } from "@symphony/db";
import { RetryService } from "@core/services/retry-service";

export interface RecoverStaleRunsInput {
  projectId: string;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
}

export interface RecoverStaleRunsResult {
  recoveredAttempts: number;
  recoveredSessions: number;
}

export class RestartRecoveryService {
  constructor(
    private readonly runAttempts: IRunAttemptRepo,
    private readonly sessions: IAgentSessionRepo,
    private readonly retryQueue: IRetryQueueRepo,
  ) {}

  recoverStaleRuns(input: RecoverStaleRunsInput): RecoverStaleRunsResult {
    const runningAttempts = this.runAttempts.listRunningRunAttempts(input.projectId);
    let recoveredSessions = 0;
    const retryService = new RetryService(this.retryQueue);

    for (const attempt of runningAttempts) {
      const sessions = this.sessions.listSessionsByRunAttempt(attempt.id);
      for (const session of sessions) {
        if (session.status !== "running") continue;
        this.sessions.updateSessionStatus(session.id, "failed");
        recoveredSessions += 1;
      }

      this.runAttempts.updateRunAttemptStatus(attempt.id, "failed", "recovered_after_restart");
      retryService.scheduleRetry({
        issueId: attempt.issueId,
        attemptNumber: attempt.attemptNumber + 1,
        baseDelayMs: input.retryBaseDelayMs,
        maxDelayMs: input.retryMaxDelayMs,
        errorMessage: "recovered_after_restart",
      });
    }

    return {
      recoveredAttempts: runningAttempts.length,
      recoveredSessions,
    };
  }
}

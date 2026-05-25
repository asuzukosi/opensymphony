import type { IAgentSessionRepo, IRunAttemptRepo, RunAttemptStatus } from "@symphony/db";
import type { AttachSessionInput, StartRunInput } from "@core/types/orchestrator";

export class RunLifecycleService {
  constructor(
    private readonly runAttempts: IRunAttemptRepo,
    private readonly sessions: IAgentSessionRepo,
  ) {}

  startRun(input: StartRunInput): void {
    this.runAttempts.createRunAttempt({
      id: input.runAttemptId,
      issueId: input.issueId,
      attemptNumber: input.attemptNumber,
      status: "running",
    });
  }

  finishRun(
    runAttemptId: string,
    status: Exclude<RunAttemptStatus, "running">,
    errorMessage?: string,
  ): void {
    this.runAttempts.updateRunAttemptStatus(runAttemptId, status, errorMessage ?? null);
  }

  attachSession(input: AttachSessionInput): void {
    this.sessions.createSession({
      id: input.sessionId,
      runAttemptId: input.runAttemptId,
      runtimeKind: input.runtimeKind,
      sessionRef: input.sessionRef ?? null,
      status: "running",
    });
  }

  finishSession(sessionId: string, status: "succeeded" | "failed" | "cancelled"): void {
    this.sessions.updateSessionStatus(sessionId, status);
  }
}

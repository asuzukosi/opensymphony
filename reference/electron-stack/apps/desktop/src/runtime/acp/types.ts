export type RuntimeSessionStatus = "running" | "succeeded" | "failed" | "cancelled";

export interface StartRuntimeSessionInput {
  runAttemptId: string;
  issueId: string;
  identifier: string;
  title: string;
  description: string | null;
  promptTemplate: string;
  attemptNumber: number;
  startedAt: string;
  workspacePath: string;
}

export interface RuntimeSessionRecord {
  sessionId: string;
  runAttemptId: string;
  issueId: string;
  attemptNumber: number;
  sessionRef: string | null;
  status: RuntimeSessionStatus;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  paused: boolean;
}

export type RuntimeSessionPhase =
  | "spawning"
  | "initializing"
  | "prompting"
  | "streaming"
  | "paused"
  | "terminal";

export interface ACPAdapter {
  startSession(input: StartRuntimeSessionInput): RuntimeSessionRecord;
  pollSessions(nowIso: string, sessionIds: string[]): RuntimeSessionRecord[];
  pauseSession(sessionId: string): RuntimeSessionRecord | null;
  resumeSession(sessionId: string): RuntimeSessionRecord | null;
  cancelSession(
    sessionId: string,
    nowIso: string,
    reason?: string,
  ): RuntimeSessionRecord | null;
  getSessionPhase(sessionId: string): RuntimeSessionPhase | null;
  getLastEventSummary(sessionId: string): string | null;
  getLastAgentMessage(sessionId: string): string | null;
  isSessionPaused(sessionId: string): boolean;
}

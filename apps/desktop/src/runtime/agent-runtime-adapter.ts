export type RuntimeSessionStatus = "running" | "succeeded" | "failed" | "cancelled";

export interface StartRuntimeSessionInput {
  runAttemptId: string;
  issueId: string;
  attemptNumber: number;
  startedAt: string;
}

export interface RuntimeSessionRecord {
  sessionId: string;
  runAttemptId: string;
  issueId: string;
  attemptNumber: number;
  runtimeKind: string;
  sessionRef: string | null;
  status: RuntimeSessionStatus;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export interface AgentRuntimeAdapter {
  startSession(input: StartRuntimeSessionInput): RuntimeSessionRecord;
  pollSessions(nowIso: string, sessionIds: string[]): RuntimeSessionRecord[];
  cancelSession(sessionId: string, nowIso: string): RuntimeSessionRecord | null;
}

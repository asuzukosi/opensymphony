import type { ACPConfig } from "@symphony/core";
import type { RuntimeAdapterKind } from "@/ipc";

export const ACP_RUNTIME_KIND = {
  mock: "mock-acp",
  subprocess: "acp-cli",
} as const satisfies Record<ACPConfig["mode"], RuntimeAdapterKind>;

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
  runtimeKind: RuntimeAdapterKind;
  sessionRef: string | null;
  status: RuntimeSessionStatus;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export interface AcpAdapter {
  startSession(input: StartRuntimeSessionInput): RuntimeSessionRecord;
  pollSessions(nowIso: string, sessionIds: string[]): RuntimeSessionRecord[];
  cancelSession(sessionId: string, nowIso: string): RuntimeSessionRecord | null;
}

export function runtimeKindFromAcpMode(mode: ACPConfig["mode"]): RuntimeAdapterKind {
  return ACP_RUNTIME_KIND[mode];
}

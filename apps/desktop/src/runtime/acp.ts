import { randomUUID } from "node:crypto";
import type { ACPConfig } from "@symphony/core";
import {
  createAcpClientAdapter,
} from "@/runtime/acp/acp-client-adapter";
import type { PermissionRouter } from "@/runtime/acp/permission-router";
import {
  ACP_RUNTIME_KIND,
  type AcpAdapter,
  type RuntimeSessionRecord,
  type StartRuntimeSessionInput,
  runtimeKindFromAcpMode,
} from "@/runtime/acp/types";

export {
  ACP_RUNTIME_KIND,
  runtimeKindFromAcpMode,
  type AcpAdapter,
  type RuntimeSessionRecord,
  type RuntimeSessionStatus,
  type StartRuntimeSessionInput,
} from "@/runtime/acp/types";

export interface CreateAcpAdapterDependencies {
  getPermissionRouter: () => PermissionRouter;
}

interface MockStoredSession extends RuntimeSessionRecord {
  expectedCompletionAt: number;
}

class MockAcpAdapter implements AcpAdapter {
  private readonly sessions = new Map<string, MockStoredSession>();

  constructor(private readonly completionDelayMs: number) {}

  startSession(input: StartRuntimeSessionInput): RuntimeSessionRecord {
    const sessionId = randomUUID();
    const startedAtMs = Date.parse(input.startedAt);
    const stored: MockStoredSession = {
      sessionId,
      runAttemptId: input.runAttemptId,
      issueId: input.issueId,
      attemptNumber: input.attemptNumber,
      runtimeKind: ACP_RUNTIME_KIND.mock,
      sessionRef: `acp://${input.issueId}/${input.attemptNumber}`,
      status: "running",
      startedAt: input.startedAt,
      finishedAt: null,
      errorMessage: null,
      expectedCompletionAt: Number.isNaN(startedAtMs)
        ? Date.now() + this.completionDelayMs
        : startedAtMs + this.completionDelayMs,
    };

    this.sessions.set(stored.sessionId, stored);
    return this.toRuntimeRecord(stored);
  }

  pollSessions(nowIso: string, sessionIds: string[]): RuntimeSessionRecord[] {
    const nowMs = Date.parse(nowIso);
    const output: RuntimeSessionRecord[] = [];

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (!session) continue;

      if (
        session.status === "running" &&
        !Number.isNaN(nowMs) &&
        nowMs >= session.expectedCompletionAt
      ) {
        if (this.shouldFail(session.issueId, session.attemptNumber)) {
          session.status = "failed";
          session.errorMessage = "mock_acp_failure";
        } else {
          session.status = "succeeded";
          session.errorMessage = null;
        }
        session.finishedAt = nowIso;
      }

      output.push(this.toRuntimeRecord(session));
    }

    return output;
  }

  cancelSession(sessionId: string, nowIso: string): RuntimeSessionRecord | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.status === "running") {
      session.status = "cancelled";
      session.finishedAt = nowIso;
      session.errorMessage = "cancelled_by_reconciliation";
    }

    return this.toRuntimeRecord(session);
  }

  private shouldFail(issueId: string, attemptNumber: number): boolean {
    return issueId.toLowerCase().includes("fail") && attemptNumber <= 2;
  }

  private toRuntimeRecord(session: MockStoredSession): RuntimeSessionRecord {
    return {
      sessionId: session.sessionId,
      runAttemptId: session.runAttemptId,
      issueId: session.issueId,
      attemptNumber: session.attemptNumber,
      runtimeKind: session.runtimeKind,
      sessionRef: session.sessionRef,
      status: session.status,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      errorMessage: session.errorMessage,
    };
  }
}

export function createAcpAdapter(
  config: ACPConfig,
  deps?: CreateAcpAdapterDependencies,
): AcpAdapter {
  if (config.mode === "mock") {
    return new MockAcpAdapter(config.mockCompletionDelayMs);
  }

  if (!deps) {
    throw new Error("acp client adapter requires permission router dependencies");
  }

  return createAcpClientAdapter(config, deps);
}

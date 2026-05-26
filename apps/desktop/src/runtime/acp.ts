import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
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

interface SubprocessStoredSession extends RuntimeSessionRecord {
  process: ChildProcessWithoutNullStreams | null;
  stdout: string[];
  stderr: string[];
}

class SubprocessAcpAdapter implements AcpAdapter {
  private readonly sessions = new Map<string, SubprocessStoredSession>();

  constructor(
    private readonly command: string,
    private readonly args: string[],
  ) {}

  startSession(input: StartRuntimeSessionInput): RuntimeSessionRecord {
    const workspacePath = input.workspacePath.trim();
    if (!workspacePath) {
      throw new Error("workspacePath is required for subprocess acp sessions");
    }

    const sessionId = randomUUID();
    const child = spawn(this.command, this.args, {
      cwd: workspacePath,
      env: {
        ...process.env,
        SYMPHONY_RUN_ATTEMPT_ID: input.runAttemptId,
        SYMPHONY_ISSUE_ID: input.issueId,
        SYMPHONY_ATTEMPT_NUMBER: String(input.attemptNumber),
        SYMPHONY_WORKSPACE_PATH: workspacePath,
      },
      stdio: "pipe",
    });

    const session: SubprocessStoredSession = {
      sessionId,
      runAttemptId: input.runAttemptId,
      issueId: input.issueId,
      attemptNumber: input.attemptNumber,
      runtimeKind: ACP_RUNTIME_KIND.subprocess,
      sessionRef: `acp-cli://${sessionId}`,
      status: "running",
      startedAt: input.startedAt,
      finishedAt: null,
      errorMessage: null,
      process: child,
      stdout: [],
      stderr: [],
    };

    child.stdout.on("data", (chunk) => {
      session.stdout.push(String(chunk));
    });
    child.stderr.on("data", (chunk) => {
      session.stderr.push(String(chunk));
    });

    child.on("error", (error) => {
      if (session.status !== "running") return;
      session.status = "failed";
      session.finishedAt = new Date().toISOString();
      session.errorMessage = `spawn_error:${error.message}`;
      session.process = null;
    });

    child.on("exit", (code) => {
      if (session.status !== "running") return;
      session.finishedAt = new Date().toISOString();
      if (code === 0) {
        session.status = "succeeded";
        session.errorMessage = null;
      } else {
        session.status = "failed";
        const stderrTail = session.stderr.join("").trim();
        session.errorMessage =
          stderrTail.length > 0 ? `exit_${String(code)}:${stderrTail}` : `exit_${String(code)}`;
      }
      session.process = null;
    });

    this.sessions.set(sessionId, session);
    return this.toRuntimeRecord(session);
  }

  pollSessions(_nowIso: string, sessionIds: string[]): RuntimeSessionRecord[] {
    return sessionIds
      .map((sessionId) => this.sessions.get(sessionId))
      .filter((session): session is SubprocessStoredSession => Boolean(session))
      .map((session) => this.toRuntimeRecord(session));
  }

  cancelSession(sessionId: string, nowIso: string): RuntimeSessionRecord | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.status === "running") {
      session.process?.kill("SIGTERM");
      session.status = "cancelled";
      session.finishedAt = nowIso;
      session.errorMessage = "cancelled_by_reconciliation";
      session.process = null;
    }

    return this.toRuntimeRecord(session);
  }

  private toRuntimeRecord(session: SubprocessStoredSession): RuntimeSessionRecord {
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

export function createAcpAdapter(config: ACPConfig): AcpAdapter {
  if (config.mode === "subprocess") {
    return new SubprocessAcpAdapter(config.command, config.args);
  }

  return new MockAcpAdapter(config.mockCompletionDelayMs);
}

export function runtimeKindFromAcpMode(mode: ACPConfig["mode"]): RuntimeAdapterKind {
  return ACP_RUNTIME_KIND[mode];
}

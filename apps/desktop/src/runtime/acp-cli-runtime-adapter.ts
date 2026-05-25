import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  AgentRuntimeAdapter,
  RuntimeSessionRecord,
  StartRuntimeSessionInput,
} from "@/runtime/agent-runtime-adapter";

interface StoredSession extends RuntimeSessionRecord {
  process: ChildProcessWithoutNullStreams | null;
  stdout: string[];
  stderr: string[];
}

export interface AcpCliRuntimeAdapterOptions {
  command: string;
  args: string[];
}

export class AcpCliRuntimeAdapter implements AgentRuntimeAdapter {
  private readonly sessions = new Map<string, StoredSession>();

  constructor(private readonly options: AcpCliRuntimeAdapterOptions) {}

  startSession(input: StartRuntimeSessionInput): RuntimeSessionRecord {
    const sessionId = randomUUID();
    const child = spawn(this.options.command, this.options.args, {
      env: {
        ...process.env,
        SYMPHONY_RUN_ATTEMPT_ID: input.runAttemptId,
        SYMPHONY_ISSUE_ID: input.issueId,
        SYMPHONY_ATTEMPT_NUMBER: String(input.attemptNumber),
      },
      stdio: "pipe",
    });

    const session: StoredSession = {
      sessionId,
      runAttemptId: input.runAttemptId,
      issueId: input.issueId,
      attemptNumber: input.attemptNumber,
      runtimeKind: "acp-cli",
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
      .filter((session): session is StoredSession => Boolean(session))
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

  private toRuntimeRecord(session: StoredSession): RuntimeSessionRecord {
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

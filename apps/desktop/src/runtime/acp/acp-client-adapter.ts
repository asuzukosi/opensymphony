import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { ACPConfig } from "@symphony/core";
import type { RuntimeAdapterKind } from "@/ipc";
import {
  defaultInitializeRequest,
  getSessionUpdateKind,
  type ClientSideConnection,
  type StopReason,
} from "@/runtime/acp/acp-protocol";
import type { PermissionRouter } from "@/runtime/acp/permission-router";
import { renderPromptTemplate } from "@/runtime/acp/prompt-renderer";
import { createACPStdioStream, type ACPStdioStreamHandle } from "@/runtime/acp/stdio-stream";
import { createSymphonyACPConnection } from "@/runtime/acp/symphony-client";
import {
  ACP_RUNTIME_KIND,
  type AcpAdapter,
  type RuntimeSessionRecord,
  type RuntimeSessionStatus,
  type StartRuntimeSessionInput,
} from "@/runtime/acp/types";

export type AcpClientSessionPhase =
  | "spawning"
  | "initializing"
  | "prompting"
  | "streaming"
  | "terminal";

export interface AcpClientAdapterDependencies {
  getPermissionRouter: () => PermissionRouter;
}

interface AcpClientStoredSession {
  sessionId: string;
  runAttemptId: string;
  issueId: string;
  attemptNumber: number;
  startedAt: string;
  finishedAt: string | null;
  status: RuntimeSessionStatus;
  errorMessage: string | null;
  phase: AcpClientSessionPhase;
  agentSessionId: string | null;
  updateCount: number;
  lastEventSummary: string | null;
  child: ChildProcessWithoutNullStreams;
  stdio: ACPStdioStreamHandle;
  connection: ClientSideConnection;
  cancelled: boolean;
  runTask: Promise<void>;
}

export class AcpClientAdapter implements AcpAdapter {
  private readonly sessions = new Map<string, AcpClientStoredSession>();
  private static readonly cancelSigtermFallbackMs = 1500;

  constructor(
    private readonly config: ACPConfig,
    private readonly deps: AcpClientAdapterDependencies,
  ) {}

  startSession(input: StartRuntimeSessionInput): RuntimeSessionRecord {
    const workspacePath = input.workspacePath.trim();
    if (!workspacePath) {
      throw new Error("workspacePath is required for acp client sessions");
    }

    const sessionId = randomUUID();
    const child = spawn(this.config.command, this.config.args, {
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

    const stdio = createACPStdioStream(child);
    const router = this.deps.getPermissionRouter();

    let stored: AcpClientStoredSession;
    const { connection } = createSymphonyACPConnection(stdio.stream, {
      requestPermission: router.createRequestPermissionHandler(input.issueId),
      sessionUpdate: async (params) => {
        if (stored.status !== "running") {
          return;
        }

        stored.phase = "streaming";
        stored.updateCount += 1;
        stored.lastEventSummary = getSessionUpdateKind(params.update);
      },
    });

    stored = {
      sessionId,
      runAttemptId: input.runAttemptId,
      issueId: input.issueId,
      attemptNumber: input.attemptNumber,
      startedAt: input.startedAt,
      finishedAt: null,
      status: "running",
      errorMessage: null,
      phase: "spawning",
      agentSessionId: null,
      updateCount: 0,
      lastEventSummary: null,
      child,
      stdio,
      connection,
      cancelled: false,
      runTask: Promise.resolve(),
    };

    this.sessions.set(sessionId, stored);

    child.on("error", (error) => {
      this.failSession(stored, `spawn_error:${error.message}`);
    });

    child.on("exit", (code, signal) => {
      if (stored.status !== "running") {
        return;
      }

      if (stored.cancelled) {
        this.finishSession(stored, "cancelled", "cancelled_by_reconciliation");
        return;
      }

      if (stored.phase !== "terminal") {
        this.failSession(
          stored,
          signal
            ? `early_process_${signal.toLowerCase()}`
            : `early_process_exit_${String(code ?? "unknown")}`,
        );
      }
    });

    stored.runTask = this.runSession(stored, input);
    return this.toRuntimeRecord(stored);
  }

  getSessionPhase(sessionId: string): AcpClientSessionPhase | null {
    return this.sessions.get(sessionId)?.phase ?? null;
  }

  getSessionUpdateCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.updateCount ?? 0;
  }

  pollSessions(_nowIso: string, sessionIds: string[]): RuntimeSessionRecord[] {
    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (!session || session.status !== "running") {
        continue;
      }

      if (session.child.exitCode !== null || session.child.signalCode !== null) {
        if (session.cancelled) {
          this.finishSession(session, "cancelled", "cancelled_by_reconciliation");
        } else if (session.phase !== "terminal") {
          const signal = session.child.signalCode;
          this.failSession(
            session,
            signal
              ? `early_process_${signal.toLowerCase()}`
              : `early_process_exit_${String(session.child.exitCode ?? "unknown")}`,
          );
        }
      }
    }

    return sessionIds
      .map((sessionId) => this.sessions.get(sessionId))
      .filter((session): session is AcpClientStoredSession => Boolean(session))
      .map((session) => this.toRuntimeRecord(session));
  }

  cancelSession(sessionId: string, nowIso: string): RuntimeSessionRecord | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.status === "running") {
      session.cancelled = true;
      void this.requestSessionCancel(session);
      this.finishSession(session, "cancelled", "cancelled_by_reconciliation", nowIso);
      this.scheduleSigtermFallback(session);
    }

    return this.toRuntimeRecord(session);
  }

  private async requestSessionCancel(session: AcpClientStoredSession): Promise<void> {
    if (!session.agentSessionId) {
      return;
    }

    try {
      await session.connection.cancel({ sessionId: session.agentSessionId });
    } catch {
      // sigterm fallback handles agents that do not accept session/cancel cleanly
    }
  }

  private scheduleSigtermFallback(session: AcpClientStoredSession): void {
    setTimeout(() => {
      if (session.child.exitCode !== null || session.child.killed) {
        return;
      }

      session.child.kill("SIGTERM");
    }, AcpClientAdapter.cancelSigtermFallbackMs);
  }

  private async runSession(
    stored: AcpClientStoredSession,
    input: StartRuntimeSessionInput,
  ): Promise<void> {
    try {
      stored.phase = "initializing";
      await stored.connection.initialize(defaultInitializeRequest());

      stored.phase = "prompting";
      const agentSession = await stored.connection.newSession({
        cwd: input.workspacePath,
        mcpServers: [],
      });
      stored.agentSessionId = agentSession.sessionId;

      const promptText = this.renderTaskPrompt(input);
      stored.phase = "streaming";
      const promptResult = await stored.connection.prompt({
        sessionId: agentSession.sessionId,
        prompt: [{ type: "text", text: promptText }],
      });

      if (stored.cancelled) {
        this.finishSession(stored, "cancelled", "cancelled_by_reconciliation");
        return;
      }

      this.completeFromStopReason(stored, promptResult.stopReason);
    } catch (error) {
      if (!stored.cancelled && stored.status === "running") {
        this.failSession(
          stored,
          error instanceof Error ? error.message : "acp_client_error",
        );
      }
    } finally {
      stored.stdio.close();
    }
  }

  private renderTaskPrompt(input: StartRuntimeSessionInput): string {
    if (input.promptTemplate.trim().length === 0) {
      return [input.identifier, input.title, input.description ?? ""].filter(Boolean).join("\n");
    }

    return renderPromptTemplate({
      promptTemplate: input.promptTemplate,
      issue: {
        identifier: input.identifier,
        title: input.title,
        description: input.description,
      },
    });
  }

  private completeFromStopReason(stored: AcpClientStoredSession, stopReason: StopReason): void {
    stored.phase = "terminal";

    if (stopReason === "end_turn") {
      this.finishSession(stored, "succeeded", null);
      return;
    }

    if (stopReason === "cancelled") {
      this.finishSession(stored, "cancelled", "cancelled_by_reconciliation");
      return;
    }

    this.finishSession(stored, "failed", `stop_reason:${stopReason}`);
  }

  private failSession(stored: AcpClientStoredSession, errorMessage: string): void {
    if (stored.status !== "running") {
      return;
    }

    stored.phase = "terminal";
    this.finishSession(stored, "failed", errorMessage);
  }

  private finishSession(
    stored: AcpClientStoredSession,
    status: RuntimeSessionStatus,
    errorMessage: string | null,
    finishedAt = new Date().toISOString(),
  ): void {
    if (stored.status !== "running") {
      return;
    }

    stored.status = status;
    stored.errorMessage = errorMessage;
    stored.finishedAt = finishedAt;
    stored.phase = "terminal";
  }

  private runtimeKind(): RuntimeAdapterKind {
    return ACP_RUNTIME_KIND.subprocess;
  }

  private toRuntimeRecord(session: AcpClientStoredSession): RuntimeSessionRecord {
    return {
      sessionId: session.sessionId,
      runAttemptId: session.runAttemptId,
      issueId: session.issueId,
      attemptNumber: session.attemptNumber,
      runtimeKind: this.runtimeKind(),
      sessionRef: session.agentSessionId,
      status: session.status,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      errorMessage: session.errorMessage,
    };
  }
}

export function createAcpClientAdapter(
  config: ACPConfig,
  deps: AcpClientAdapterDependencies,
): AcpClientAdapter {
  return new AcpClientAdapter(config, deps);
}

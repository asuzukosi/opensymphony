/** acp runtime migrated to src-tauri — stub for reference orchestrator until Lane 3 dispatch. */

import type { PermissionMode } from "@symphony/core";

export type PermissionDecision = "approve" | "deny";

export type RuntimeSessionStatus = "running" | "succeeded" | "failed" | "cancelled";

export type RuntimeSessionPhase =
  | "spawning"
  | "initializing"
  | "prompting"
  | "streaming"
  | "paused"
  | "terminal";

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

export interface ACPClientAdapterDependencies {
  getPermissionRouter: () => PermissionRouter;
  appendSessionEvent?: (input: unknown) => void;
}

export interface PendingPermission {
  id: string;
  sessionId: string;
  issueId: string;
  summary: string;
  payload: unknown;
  createdAt: string;
}

export interface EnqueuePermissionInput {
  issueId: string;
  request: {
    sessionId: string;
    options: Array<{ optionId: string; kind: string }>;
    toolCall?: { title?: string | null };
  };
}

interface PendingPermissionEntry extends PendingPermission {
  settle: (response: unknown) => void;
}

function permissionSummary(request: EnqueuePermissionInput["request"]): string {
  return request.toolCall?.title?.trim() || "permission requested";
}

function buildPermissionResponse(
  request: EnqueuePermissionInput["request"],
  decision: PermissionDecision,
): unknown {
  const preferredKinds =
    decision === "approve"
      ? (["allow_once", "allow_always"] as const)
      : (["reject_once", "reject_always"] as const);

  for (const kind of preferredKinds) {
    const option = request.options.find((entry) => entry.kind === kind);
    if (option) {
      return { outcome: { outcome: "selected", optionId: option.optionId } };
    }
  }

  const fallback = request.options[0];
  if (!fallback) {
    return { outcome: { outcome: "cancelled" } };
  }

  return { outcome: { outcome: "selected", optionId: fallback.optionId } };
}

export class PermissionStore {
  private readonly pending = new Map<string, PendingPermissionEntry>();

  enqueue(input: EnqueuePermissionInput, createdAt = new Date().toISOString()): {
    id: string;
    waitForDecision: () => Promise<unknown>;
  } {
    const id = crypto.randomUUID();
    const pending: PendingPermission = {
      id,
      sessionId: input.request.sessionId,
      issueId: input.issueId,
      summary: permissionSummary(input.request),
      payload: input.request,
      createdAt,
    };

    let settle!: (response: unknown) => void;
    const waitForDecision = new Promise<unknown>((resolve) => {
      settle = resolve;
    });

    this.pending.set(id, { ...pending, settle });

    return { id, waitForDecision: () => waitForDecision };
  }

  listPending(): PendingPermission[] {
    return [...this.pending.values()].map(({ settle: _settle, ...pending }) => pending);
  }

  resolve(id: string, decision: PermissionDecision): boolean {
    const entry = this.pending.get(id);
    if (!entry) {
      return false;
    }

    this.pending.delete(id);
    entry.settle(buildPermissionResponse(entry.payload as EnqueuePermissionInput["request"], decision));
    return true;
  }
}

export function createPermissionStore(): PermissionStore {
  return new PermissionStore();
}

export interface PermissionRouterOptions {
  store: PermissionStore;
  getPermissionMode: () => PermissionMode;
}

export class PermissionRouter {
  constructor(private readonly options: PermissionRouterOptions) {}

  async routeRequest(input: EnqueuePermissionInput): Promise<unknown> {
    if (this.options.getPermissionMode() === "auto_approve") {
      return buildPermissionResponse(input.request, "approve");
    }

    const { waitForDecision } = this.options.store.enqueue(input);
    return waitForDecision();
  }
}

export function createPermissionRouter(options: PermissionRouterOptions): PermissionRouter {
  return new PermissionRouter(options);
}

export function createACPClientAdapter(
  _config: unknown,
  _deps: ACPClientAdapterDependencies,
): ACPAdapter {
  throw new Error("acp runtime migrated to tauri (src-tauri/src/acp)");
}

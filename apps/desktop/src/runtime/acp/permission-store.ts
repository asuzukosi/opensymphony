import { randomUUID } from "node:crypto";
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionId,
} from "@/runtime/acp/acp-protocol";

export type PermissionDecision = "approve" | "deny";

export interface PendingPermission {
  id: string;
  sessionId: SessionId;
  issueId: string;
  summary: string;
  payload: RequestPermissionRequest;
  createdAt: string;
}

export interface EnqueuePermissionInput {
  issueId: string;
  request: RequestPermissionRequest;
}

interface PendingPermissionEntry extends PendingPermission {
  settle: (response: RequestPermissionResponse) => void;
}

function permissionSummary(request: RequestPermissionRequest): string {
  return request?.toolCall?.title?.trim() || "permission requested";
}

export function buildPermissionResponse(
  request: RequestPermissionRequest,
  decision: PermissionDecision,
): RequestPermissionResponse {
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
    waitForDecision: () => Promise<RequestPermissionResponse>;
  } {
    const id = randomUUID();
    const pending: PendingPermission = {
      id,
      sessionId: input.request.sessionId,
      issueId: input.issueId,
      summary: permissionSummary(input.request),
      payload: input.request,
      createdAt,
    };

    let settle!: (response: RequestPermissionResponse) => void;
    const waitForDecision = new Promise<RequestPermissionResponse>((resolve) => {
      settle = resolve;
    });

    this.pending.set(id, { ...pending, settle });

    return { id, waitForDecision: () => waitForDecision };
  }

  listPending(): PendingPermission[] {
    return [...this.pending.values()].map(({ settle: _settle, ...pending }) => pending);
  }

  getPending(id: string): PendingPermission | null {
    const entry = this.pending.get(id);
    if (!entry) {
      return null;
    }

    const { settle: _settle, ...pending } = entry;
    return pending;
  }

  resolve(id: string, decision: PermissionDecision): boolean {
    const entry = this.pending.get(id);
    if (!entry) {
      return false;
    }

    this.pending.delete(id);
    entry.settle(buildPermissionResponse(entry.payload, decision));
    return true;
  }

  cancel(id: string): boolean {
    const entry = this.pending.get(id);
    if (!entry) {
      return false;
    }

    this.pending.delete(id);
    entry.settle({ outcome: { outcome: "cancelled" } });
    return true;
  }

  cancelForSession(sessionId: SessionId): number {
    let cancelled = 0;

    for (const [id, entry] of this.pending.entries()) {
      if (entry.sessionId !== sessionId) {
        continue;
      }

      this.pending.delete(id);
      entry.settle({ outcome: { outcome: "cancelled" } });
      cancelled += 1;
    }

    return cancelled;
  }
}

export function createPermissionStore(): PermissionStore {
  return new PermissionStore();
}

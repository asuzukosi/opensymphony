import { describe, expect, test } from "vitest";
import {
  createPermissionStore,
  type PermissionDecision,
} from "@/runtime/acp/permission-store";

function sampleRequest(sessionId = "session-1") {
  return {
    sessionId,
    options: [
      { optionId: "allow-once", name: "Allow once", kind: "allow_once" as const },
      { optionId: "reject-once", name: "Reject", kind: "reject_once" as const },
    ],
    toolCall: {
      toolCallId: "tool-1",
      title: "Run tests",
      kind: "execute" as const,
      status: "pending" as const,
    },
  };
}

describe("permission-store", () => {
  test("enqueue exposes pending item until resolved", async () => {
    const store = createPermissionStore();
    const { id, waitForDecision } = store.enqueue({
      issueId: "issue-1",
      request: sampleRequest(),
    });

    expect(store.listPending()).toEqual([
      expect.objectContaining({
        id,
        sessionId: "session-1",
        issueId: "issue-1",
        summary: "Run tests",
      }),
    ]);

    const decisionPromise = waitForDecision();
    expect(store.resolve(id, "approve")).toBe(true);
    await expect(decisionPromise).resolves.toEqual({
      outcome: { outcome: "selected", optionId: "allow-once" },
    });
    expect(store.listPending()).toEqual([]);
  });

  test("resolve deny selects a reject option", async () => {
    const store = createPermissionStore();
    const { id, waitForDecision } = store.enqueue({
      issueId: "issue-1",
      request: sampleRequest(),
    });

    const decisionPromise = waitForDecision();
    store.resolve(id, "deny");

    await expect(decisionPromise).resolves.toEqual({
      outcome: { outcome: "selected", optionId: "reject-once" },
    });
  });

  test("cancel resolves with cancelled outcome", async () => {
    const store = createPermissionStore();
    const { id, waitForDecision } = store.enqueue({
      issueId: "issue-1",
      request: sampleRequest(),
    });

    const decisionPromise = waitForDecision();
    expect(store.cancel(id)).toBe(true);

    await expect(decisionPromise).resolves.toEqual({
      outcome: { outcome: "cancelled" },
    });
  });

  test("resolve returns false for unknown ids", () => {
    const store = createPermissionStore();

    expect(store.resolve("missing", "approve" as PermissionDecision)).toBe(false);
    expect(store.cancel("missing")).toBe(false);
  });
});

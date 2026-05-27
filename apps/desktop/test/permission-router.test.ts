import { describe, expect, test } from "vitest";
import type { RequestPermissionRequest } from "@/runtime/acp/acp-protocol";
import {
  createPermissionRouter,
  type PermissionMode,
} from "@/runtime/acp/permission-router";
import { createPermissionStore } from "@/runtime/acp/permission-store";

function sampleRequest(sessionId = "session-1"): RequestPermissionRequest {
  return {
    sessionId,
    options: [
      { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
      { optionId: "reject-once", name: "Reject", kind: "reject_once" },
    ],
    toolCall: {
      toolCallId: "tool-1",
      title: "Run tests",
      kind: "execute",
      status: "pending",
    },
  };
}

describe("permission-router", () => {
  test("auto_approve selects an allow option without enqueueing", async () => {
    const store = createPermissionStore();
    let mode: PermissionMode = "auto_approve";
    const router = createPermissionRouter({
      store,
      getPermissionMode: () => mode,
    });

    await expect(
      router.routeRequest({ issueId: "issue-1", request: sampleRequest() }),
    ).resolves.toEqual({
      outcome: { outcome: "selected", optionId: "allow-once" },
    });
    expect(store.listPending()).toEqual([]);
  });

  test("requires_approval enqueues and blocks until resolved", async () => {
    const store = createPermissionStore();
    const router = createPermissionRouter({
      store,
      getPermissionMode: () => "requires_approval",
    });

    const decisionPromise = router.routeRequest({
      issueId: "issue-1",
      request: sampleRequest(),
    });

    const pending = store.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      issueId: "issue-1",
      sessionId: "session-1",
      summary: "Run tests",
    });

    expect(store.resolve(pending[0]!.id, "deny")).toBe(true);
    await expect(decisionPromise).resolves.toEqual({
      outcome: { outcome: "selected", optionId: "reject-once" },
    });
  });

  test("createRequestPermissionHandler binds issue id for symphony client wiring", async () => {
    const store = createPermissionStore();
    const router = createPermissionRouter({
      store,
      getPermissionMode: () => "requires_approval",
    });
    const handler = router.createRequestPermissionHandler("issue-42");

    const decisionPromise = handler(sampleRequest());
    const pending = store.listPending();

    expect(pending).toEqual([expect.objectContaining({ issueId: "issue-42" })]);
    store.resolve(pending[0]!.id, "approve");
    await expect(decisionPromise).resolves.toEqual({
      outcome: { outcome: "selected", optionId: "allow-once" },
    });
  });

  test("reads permission mode on each request", async () => {
    const store = createPermissionStore();
    let mode: PermissionMode = "requires_approval";
    const router = createPermissionRouter({
      store,
      getPermissionMode: () => mode,
    });

    const blocked = router.routeRequest({
      issueId: "issue-1",
      request: sampleRequest("session-a"),
    });
    expect(store.listPending()).toHaveLength(1);

    mode = "auto_approve";
    await expect(
      router.routeRequest({ issueId: "issue-1", request: sampleRequest("session-b") }),
    ).resolves.toEqual({
      outcome: { outcome: "selected", optionId: "allow-once" },
    });
    expect(store.listPending()).toHaveLength(1);

    store.cancel(store.listPending()[0]!.id);
    await expect(blocked).resolves.toEqual({
      outcome: { outcome: "cancelled" },
    });
  });
});

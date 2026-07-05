import { describe, expect, test } from "vitest";
import {
  IPC_CHANNELS,
  type PendingPermission,
  type ResolvePermissionRequest,
} from "@/ipc";

describe("ipc contract", () => {
  test("declares permission ipc channels", () => {
    expect(IPC_CHANNELS.getPendingPermissions).toBe("symphony:get-pending-permissions");
    expect(IPC_CHANNELS.resolvePermission).toBe("symphony:resolve-permission");
  });

  test("pending permission shape is serializable for renderer use", () => {
    const pending: PendingPermission = {
      id: "perm-1",
      sessionId: "session-1",
      issueId: "issue-1",
      summary: "Run tests",
      payload: { toolCall: { title: "Run tests" } },
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    expect(JSON.parse(JSON.stringify(pending))).toEqual(pending);
  });

  test("resolve permission request accepts approve and deny", () => {
    const approve: ResolvePermissionRequest = { id: "perm-1", decision: "approve" };
    const deny: ResolvePermissionRequest = { id: "perm-1", decision: "deny" };

    expect(approve.decision).toBe("approve");
    expect(deny.decision).toBe("deny");
  });
});

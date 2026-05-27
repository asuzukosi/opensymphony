import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const tempDirs: string[] = [];
let userDataDir = "";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === "userData") {
        return userDataDir;
      }
      return "/tmp/electron-mock";
    }),
  },
}));

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

describe("permission ipc", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-permission-ipc-"));
    tempDirs.push(userDataDir);
  });

  afterEach(async () => {
    vi.resetModules();
    if (originalWorkflowPath === undefined) {
      delete process.env.SYMPHONY_WORKFLOW_PATH;
    } else {
      process.env.SYMPHONY_WORKFLOW_PATH = originalWorkflowPath;
    }
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  async function loadRuntime() {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-permission-ipc-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
poll_interval_ms: 30000
acp:
  mode: mock
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    return import("../src/orchestrator-runtime");
  }

  test("getPendingPermissions returns empty list in auto_approve mode", async () => {
    const { getPendingPermissions, getPermissionStore, stopOrchestratorRuntime } =
      await loadRuntime();

    getPermissionStore().enqueue({
      issueId: "issue-1",
      request: sampleRequest(),
    });

    expect(getPendingPermissions()).toEqual([]);
    stopOrchestratorRuntime();
  });

  test("resolvePermission unblocks an enqueued permission in requires_approval mode", async () => {
    const {
      getPendingPermissions,
      getPermissionStore,
      resolvePermission,
      setOrchestratorPermissionMode,
      stopOrchestratorRuntime,
    } = await loadRuntime();

    setOrchestratorPermissionMode("requires_approval");

    const { id, waitForDecision } = getPermissionStore().enqueue({
      issueId: "issue-1",
      request: sampleRequest(),
    });

    expect(getPendingPermissions()).toEqual([
      expect.objectContaining({
        id,
        issueId: "issue-1",
        summary: "Run tests",
      }),
    ]);

    const decisionPromise = waitForDecision();
    resolvePermission({ id, decision: "approve" });

    await expect(decisionPromise).resolves.toEqual({
      outcome: { outcome: "selected", optionId: "allow-once" },
    });
    expect(getPendingPermissions()).toEqual([]);

    stopOrchestratorRuntime();
  });

  test("resolvePermission rejects unknown ids and auto_approve mode", async () => {
    const {
      resolvePermission,
      setOrchestratorPermissionMode,
      stopOrchestratorRuntime,
    } = await loadRuntime();

    expect(() => resolvePermission({ id: "missing", decision: "approve" })).toThrow(
      "resolvePermission is unavailable when permission mode is auto_approve",
    );

    setOrchestratorPermissionMode("requires_approval");
    expect(() => resolvePermission({ id: "missing", decision: "approve" })).toThrow(
      "pending permission not found: missing",
    );

    stopOrchestratorRuntime();
  });
});

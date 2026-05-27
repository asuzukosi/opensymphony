import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { closeDatabase, createTrackerStore, openDatabase } from "@symphony/db";
import { TrackerService } from "@symphony/core";
import { DEMO_ACP_SERVER_PATH } from "./fixtures/demo-acp-workflow";

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

describe("orchestrator ACP runtime integration", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-orchestrator-acp-runtime-"));
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

  async function loadRuntime(workspaceRoot: string) {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-orchestrator-acp-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
max_concurrency: 1
workspace_root: ${workspaceRoot}
acp:
  command: ${process.execPath}
  args: ${JSON.stringify([DEMO_ACP_SERVER_PATH])}
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const runtime = await import("../src/orchestrator-runtime");
    runtime.getProjectBoard();
    return runtime;
  }

  async function waitForRunStatus(
    runOrchestratorTick: (nowIso?: string) => void,
    store: ReturnType<typeof createTrackerStore>,
    issueId: string,
    expectedStatus: string,
    timeoutMs = 5000,
  ): Promise<void> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      runOrchestratorTick(new Date().toISOString());
      const run = store.runAttempts.getLatestRunAttempt(issueId);
      if (run?.status === expectedStatus) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`timed out waiting for run status ${expectedStatus}`);
  }

  test("orchestrator tick completes dispatched ACP client sessions", async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), "symphony-issue-workspaces-acp-"));
    tempDirs.push(workspaceRoot);

    const { runOrchestratorTick, stopOrchestratorRuntime } = await loadRuntime(workspaceRoot);

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const tracker = new TrackerService(store);
    tracker.createIssue({
      id: "issue-acp-client",
      projectId: "symphony-local",
      identifier: "SYMPHONYLOCAL-1",
      title: "ACP client happy path",
    });

    runOrchestratorTick("2026-01-01T00:00:00.000Z");

    let run = store.runAttempts.getLatestRunAttempt("issue-acp-client");
    expect(run?.status).toBe("running");
    expect(store.agentSessions.listSessionsByRunAttempt(run!.id)).toEqual([
      expect.objectContaining({ status: "running" }),
    ]);

    await waitForRunStatus(runOrchestratorTick, store, "issue-acp-client", "succeeded");

    run = store.runAttempts.getLatestRunAttempt("issue-acp-client");
    expect(run?.status).toBe("succeeded");
    expect(store.retryQueue.getRetry("issue-acp-client")).toBeNull();

    const sessions = store.agentSessions.listSessionsByRunAttempt(run!.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionRef).toMatch(/^[0-9a-f-]{36}$/);

    closeDatabase(db);
    stopOrchestratorRuntime();
  });
});

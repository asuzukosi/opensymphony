import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { closeDatabase, createTrackerStore, openDatabase } from "@symphony/db";
import { TrackerService } from "@symphony/core";

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

describe("mock acp runtime integration", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-mock-acp-runtime-"));
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

  async function loadRuntime(workflowBody: string) {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-mock-acp-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(workflowPath, workflowBody);
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const runtime = await import("../src/orchestrator-runtime");
    runtime.getProjectBoard();
    return runtime;
  }

  function openStore() {
    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    return { db, store };
  }

  test("completes dispatched mock sessions after configured delay", async () => {
    const { runOrchestratorTick, stopOrchestratorRuntime } = await loadRuntime(`---
project_id: symphony-local
max_concurrency: 1
acp:
  mode: mock
  mock_completion_delay_ms: 1000
---

Run the issue.
`);

    const { db, store } = openStore();
    const tracker = new TrackerService(store);
    tracker.createIssue({
      id: "issue-ok",
      projectId: "symphony-local",
      identifier: "SYMPHONYLOCAL-1",
      title: "Happy path",
    });

    const tickStart = "2026-01-01T00:00:00.000Z";
    runOrchestratorTick(tickStart);

    let run = store.runAttempts.getLatestRunAttempt("issue-ok");
    expect(run?.status).toBe("running");
    expect(store.agentSessions.listSessionsByRunAttempt(run!.id)).toEqual([
      expect.objectContaining({ status: "running", runtimeKind: "mock-acp" }),
    ]);

    runOrchestratorTick("2026-01-01T00:00:00.500Z");
    run = store.runAttempts.getLatestRunAttempt("issue-ok");
    expect(run?.status).toBe("running");

    runOrchestratorTick("2026-01-01T00:00:02.000Z");
    run = store.runAttempts.getLatestRunAttempt("issue-ok");
    expect(run?.status).toBe("succeeded");
    expect(store.retryQueue.getRetry("issue-ok")).toBeNull();

    closeDatabase(db);
    stopOrchestratorRuntime();
  });

  test("fails fail-tagged issue ids through orchestrator tick and schedules retry", async () => {
    const { runOrchestratorTick, stopOrchestratorRuntime } = await loadRuntime(`---
project_id: symphony-local
max_concurrency: 1
acp:
  mode: mock
  mock_completion_delay_ms: 1
---

Run the issue.
`);

    const { db, store } = openStore();
    const tracker = new TrackerService(store);
    tracker.createIssue({
      id: "issue-fail-demo",
      projectId: "symphony-local",
      identifier: "SYMPHONYLOCAL-1",
      title: "Should fail mock run",
    });

    runOrchestratorTick("2026-01-01T00:00:00.000Z");
    runOrchestratorTick("2026-01-01T00:00:00.010Z");

    const run = store.runAttempts.getLatestRunAttempt("issue-fail-demo");
    expect(run?.status).toBe("failed");
    expect(run?.errorMessage).toBe("mock_acp_failure");

    const retry = store.retryQueue.getRetry("issue-fail-demo");
    expect(retry).toMatchObject({
      issueId: "issue-fail-demo",
      attemptNumber: 2,
      errorMessage: "mock_acp_failure",
    });

    closeDatabase(db);
    stopOrchestratorRuntime();
  });
});

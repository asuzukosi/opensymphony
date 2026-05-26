import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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

describe("subprocess acp runtime integration", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-subprocess-acp-runtime-"));
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

  async function loadRuntime(workspaceRoot: string, commandPath: string) {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-subprocess-acp-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
max_concurrency: 1
workspace_root: ${workspaceRoot}
acp:
  mode: subprocess
  command: ${commandPath}
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
    timeoutMs = 3000,
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

  test("orchestrator tick spawns subprocess with issue workspace cwd", async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), "symphony-issue-workspaces-"));
    tempDirs.push(workspaceRoot);
    const expectedWorkspacePath = path.join(workspaceRoot, "symphonylocal-1");
    const markerPath = path.join(expectedWorkspacePath, "cwd-marker.txt");

    const scriptDir = mkdtempSync(path.join(tmpdir(), "symphony-subprocess-script-"));
    tempDirs.push(scriptDir);
    const scriptPath = path.join(scriptDir, "write-cwd.sh");
    writeFileSync(
      scriptPath,
      "#!/bin/sh\nprintf '%s' \"$(pwd)\" > cwd-marker.txt\nexit 0\n",
      { mode: 0o755 },
    );

    const { runOrchestratorTick, stopOrchestratorRuntime } = await loadRuntime(
      workspaceRoot,
      scriptPath,
    );

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const tracker = new TrackerService(store);
    tracker.createIssue({
      id: "issue-subprocess",
      projectId: "symphony-local",
      identifier: "SYMPHONYLOCAL-1",
      title: "Subprocess cwd check",
    });

    runOrchestratorTick("2026-01-01T00:00:00.000Z");
    await waitForRunStatus(runOrchestratorTick, store, "issue-subprocess", "succeeded");

    expect(readFileSync(markerPath, "utf8")).toBe(realpathSync(expectedWorkspacePath));
    expect(realpathSync(expectedWorkspacePath)).not.toBe(realpathSync(process.cwd()));

    closeDatabase(db);
    stopOrchestratorRuntime();
  });

  test("orchestrator tick passes symphony env vars to subprocess", async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), "symphony-issue-workspaces-env-"));
    tempDirs.push(workspaceRoot);
    const expectedWorkspacePath = path.join(workspaceRoot, "symphonylocal-1");

    const scriptDir = mkdtempSync(path.join(tmpdir(), "symphony-subprocess-env-script-"));
    tempDirs.push(scriptDir);
    const scriptPath = path.join(scriptDir, "write-env.sh");
    writeFileSync(
      scriptPath,
      `#!/bin/sh
printf '%s' "$SYMPHONY_ISSUE_ID" > issue-id.txt
printf '%s' "$SYMPHONY_RUN_ATTEMPT_ID" > run-attempt-id.txt
printf '%s' "$SYMPHONY_ATTEMPT_NUMBER" > attempt-number.txt
exit 0
`,
      { mode: 0o755 },
    );

    const { runOrchestratorTick, stopOrchestratorRuntime } = await loadRuntime(
      workspaceRoot,
      scriptPath,
    );

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const tracker = new TrackerService(store);
    tracker.createIssue({
      id: "issue-subprocess-env",
      projectId: "symphony-local",
      identifier: "SYMPHONYLOCAL-1",
      title: "Subprocess env check",
    });

    runOrchestratorTick("2026-01-01T00:00:00.000Z");
    await waitForRunStatus(runOrchestratorTick, store, "issue-subprocess-env", "succeeded");

    expect(readFileSync(path.join(expectedWorkspacePath, "issue-id.txt"), "utf8")).toBe(
      "issue-subprocess-env",
    );
    expect(readFileSync(path.join(expectedWorkspacePath, "run-attempt-id.txt"), "utf8")).toBe(
      "issue-subprocess-env:attempt:1",
    );
    expect(readFileSync(path.join(expectedWorkspacePath, "attempt-number.txt"), "utf8")).toBe("1");

    closeDatabase(db);
    stopOrchestratorRuntime();
  });

  test("orchestrator tick stores subprocess stderr tail on failed run", async () => {
    const workspaceRoot = mkdtempSync(path.join(tmpdir(), "symphony-issue-workspaces-stderr-"));
    tempDirs.push(workspaceRoot);

    const scriptDir = mkdtempSync(path.join(tmpdir(), "symphony-subprocess-stderr-script-"));
    tempDirs.push(scriptDir);
    const scriptPath = path.join(scriptDir, "fail-with-stderr.sh");
    writeFileSync(
      scriptPath,
      `#!/bin/sh
printf '%s' 'agent stderr tail marker' 1>&2
exit 4
`,
      { mode: 0o755 },
    );

    const { runOrchestratorTick, stopOrchestratorRuntime } = await loadRuntime(
      workspaceRoot,
      scriptPath,
    );

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const tracker = new TrackerService(store);
    tracker.createIssue({
      id: "issue-subprocess-stderr",
      projectId: "symphony-local",
      identifier: "SYMPHONYLOCAL-1",
      title: "Subprocess stderr failure",
    });

    runOrchestratorTick("2026-01-01T00:00:00.000Z");
    await waitForRunStatus(runOrchestratorTick, store, "issue-subprocess-stderr", "failed");

    const run = store.runAttempts.getLatestRunAttempt("issue-subprocess-stderr");
    expect(run?.errorMessage).toBe("exit_4:agent stderr tail marker");

    const retry = store.retryQueue.getRetry("issue-subprocess-stderr");
    expect(retry).toMatchObject({
      issueId: "issue-subprocess-stderr",
      attemptNumber: 2,
      errorMessage: "exit_4:agent stderr tail marker",
    });

    closeDatabase(db);
    stopOrchestratorRuntime();
  });
});

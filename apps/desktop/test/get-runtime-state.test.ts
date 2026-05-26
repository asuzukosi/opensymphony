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

describe("getRuntimeState", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-get-runtime-state-"));
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

  test("returns enriched snapshot assembled by buildRuntimeSnapshot", async () => {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
acp:
  mode: mock
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const { getRuntimeState, stopOrchestratorRuntime } = await import("../src/orchestrator-runtime");
    const snapshot = getRuntimeState(0);

    expect(snapshot.generatedAt).toEqual(expect.any(String));
    expect(snapshot.workflowPath).toBe(workflowPath);
    expect(snapshot.validationError).toBeNull();
    expect(snapshot.counts).toEqual({
      running: 0,
      retrying: 0,
      candidates: 0,
    });
    expect(snapshot.agentTotals).toEqual({
      activeSessions: 0,
      mockAcp: 0,
      acpCli: 0,
    });
    expect(snapshot.running).toEqual([]);
    expect(snapshot.retrying).toEqual([]);
    expect(snapshot.candidates).toEqual([]);
    expect(snapshot.recentEvents).toEqual([]);
    expect(snapshot.recentFinished).toEqual([]);

    stopOrchestratorRuntime();
  });
});

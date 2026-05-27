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

describe("getSettings", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-get-settings-"));
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
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-settings-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(workflowPath, workflowBody);
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const runtime = await import("../src/orchestrator-runtime");
    return { ...runtime, workflowPath };
  }

  test("returns workflow path, project meta, acp config, and poll interval from workflow", async () => {
    const { getSettings, stopOrchestratorRuntime, workflowPath } = await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 45000
acp:
  mode: mock
  mock_completion_delay_ms: 900
---

Run the issue.
`);

    const settings = getSettings();

    expect(settings.workflowPath).toBe(workflowPath);
    expect(settings.workflowVersion).toEqual(expect.any(String));
    expect(settings.pollIntervalMs).toBe(45_000);
    expect(settings.pollIntervalSource).toBe("workflow");
    expect(settings.permissionMode).toBe("auto_approve");
    expect(settings.permissionModeSource).toBe("workflow");
    expect(settings.runtimeAdapterKind).toBe("mock-acp");
    expect(settings.project).toEqual({
      id: "symphony-local",
      name: "symphony-local",
      slug: "symphony-local",
    });
    expect(settings.acp.mode).toBe("mock");
    expect(settings.acp.mockCompletionDelayMs).toBe(900);
    expect(settings.acp.command).toEqual(expect.any(String));
    expect(settings.acp.args.length).toBeGreaterThan(0);
    expect(settings.status).toBe("idle");

    stopOrchestratorRuntime();
  });

  test("reflects poll interval override from controlRuntime", async () => {
    const { controlRuntime, getSettings, stopOrchestratorRuntime } = await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 30000
acp:
  mode: mock
---

Run the issue.
`);

    await controlRuntime({ action: "setPollInterval", pollIntervalMs: 12_000 });
    const settings = getSettings();

    expect(settings.pollIntervalMs).toBe(12_000);
    expect(settings.pollIntervalSource).toBe("override");

    stopOrchestratorRuntime();
  });

  test("reflects permission mode override from controlRuntime", async () => {
    const { controlRuntime, getSettings, stopOrchestratorRuntime } = await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 30000
acp:
  mode: mock
  permission_mode: auto_approve
---

Run the issue.
`);

    controlRuntime({ action: "setPermissionMode", permissionMode: "requires_approval" });
    const settings = getSettings();

    expect(settings.permissionMode).toBe("requires_approval");
    expect(settings.permissionModeSource).toBe("override");

    stopOrchestratorRuntime();
  });
});

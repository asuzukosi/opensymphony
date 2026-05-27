import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { demoAcpWorkflowBlock } from "./fixtures/demo-acp-workflow";

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

describe("controlRuntime", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-control-runtime-"));
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

  async function loadRuntime(workflowBody = `---
project_id: symphony-local
poll_interval_ms: 30000
${demoAcpWorkflowBlock()}
---

Run the issue.
`) {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-control-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(workflowPath, workflowBody);
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const runtime = await import("../src/orchestrator-runtime");
    return { ...runtime, workflowPath };
  }

  test("start and stop return runtime snapshots", async () => {
    const { controlRuntime, stopOrchestratorRuntime } = await loadRuntime();

    const started = controlRuntime({ action: "start" });
    expect(started.status).toBe("running");
    expect(started.startedAt).toEqual(expect.any(String));
    expect(started.nextTickAt).toEqual(expect.any(String));

    const stopped = controlRuntime({ action: "stop" });
    expect(stopped.status).toBe("stopped");
    expect(stopped.nextTickAt).toBeNull();

    stopOrchestratorRuntime();
  });

  test("tick returns enriched snapshot and increments tick count", async () => {
    const { controlRuntime, stopOrchestratorRuntime } = await loadRuntime();

    controlRuntime({ action: "start" });
    const beforeTick = controlRuntime({ action: "tick" });

    expect(beforeTick.tickCount).toBe(1);
    expect(beforeTick.lastTickAt).toEqual(expect.any(String));
    expect(beforeTick.counts).toEqual({
      running: 0,
      retrying: 0,
      candidates: 0,
    });

    const afterTick = controlRuntime({ action: "tick" });
    expect(afterTick.tickCount).toBe(2);

    stopOrchestratorRuntime();
  });

  test("setPollInterval and clearPollIntervalOverride update poll settings", async () => {
    const { controlRuntime, stopOrchestratorRuntime } = await loadRuntime();

    controlRuntime({ action: "start" });

    const overridden = controlRuntime({
      action: "setPollInterval",
      pollIntervalMs: 5000,
    });
    expect(overridden.pollIntervalMs).toBe(5000);
    expect(overridden.pollIntervalSource).toBe("override");

    const reset = controlRuntime({ action: "clearPollIntervalOverride" });
    expect(reset.pollIntervalMs).toBe(30_000);
    expect(reset.pollIntervalSource).toBe("workflow");

    stopOrchestratorRuntime();
  });

  test("rejects poll intervals below 1000 ms", async () => {
    const { controlRuntime, stopOrchestratorRuntime } = await loadRuntime();

    expect(() =>
      controlRuntime({
        action: "setPollInterval",
        pollIntervalMs: 500,
      }),
    ).toThrow("pollIntervalMs must be at least 1000 ms");

    stopOrchestratorRuntime();
  });

  test("setPermissionMode and clearPermissionModeOverride update permission settings", async () => {
    const { controlRuntime, getSettings, stopOrchestratorRuntime } = await loadRuntime();

    controlRuntime({ action: "start" });

    const overridden = controlRuntime({
      action: "setPermissionMode",
      permissionMode: "requires_approval",
    });
    expect(overridden.lastAction).toBe("permission_mode_updated");
    expect(getSettings().permissionMode).toBe("requires_approval");
    expect(getSettings().permissionModeSource).toBe("override");

    const reset = controlRuntime({ action: "clearPermissionModeOverride" });
    expect(reset.lastAction).toBe("permission_mode_reset_to_workflow");
    expect(getSettings().permissionMode).toBe("auto_approve");
    expect(getSettings().permissionModeSource).toBe("workflow");

    stopOrchestratorRuntime();
  });

  test("clearPermissionModeOverride restores workflow requires_approval default", async () => {
    const { controlRuntime, getSettings, stopOrchestratorRuntime } = await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 30000
${demoAcpWorkflowBlock(["  permission_mode: requires_approval"])}
---

Run the issue.
`);

    controlRuntime({
      action: "setPermissionMode",
      permissionMode: "auto_approve",
    });
    expect(getSettings().permissionMode).toBe("auto_approve");
    expect(getSettings().permissionModeSource).toBe("override");

    controlRuntime({ action: "clearPermissionModeOverride" });
    expect(getSettings().permissionMode).toBe("requires_approval");
    expect(getSettings().permissionModeSource).toBe("workflow");

    stopOrchestratorRuntime();
  });

  test("permission mode override survives workflow reload", async () => {
    const { controlRuntime, getRuntimeState, getSettings, stopOrchestratorRuntime, workflowPath } =
      await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 30000
${demoAcpWorkflowBlock(["  permission_mode: requires_approval"])}
---

Run the issue.
`);

    controlRuntime({
      action: "setPermissionMode",
      permissionMode: "auto_approve",
    });

    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
poll_interval_ms: 30000
${demoAcpWorkflowBlock(["  permission_mode: requires_approval"])}
---

Run the issue with updated workflow body.
`,
    );

    getRuntimeState();

    expect(getSettings().permissionMode).toBe("auto_approve");
    expect(getSettings().permissionModeSource).toBe("override");
    expect(getSettings().promptTemplate).toBe("Run the issue with updated workflow body.");

    stopOrchestratorRuntime();
  });

  test("setPermissionMode to auto_approve via controlRuntime", async () => {
    const { controlRuntime, getSettings, stopOrchestratorRuntime } = await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 30000
${demoAcpWorkflowBlock(["  permission_mode: requires_approval"])}
---

Run the issue.
`);

    controlRuntime({
      action: "setPermissionMode",
      permissionMode: "auto_approve",
    });

    expect(getSettings().permissionMode).toBe("auto_approve");
    expect(getSettings().permissionModeSource).toBe("override");

    stopOrchestratorRuntime();
  });

  test("rejects invalid permission modes", async () => {
    const { controlRuntime, stopOrchestratorRuntime } = await loadRuntime();

    expect(() =>
      controlRuntime({
        action: "setPermissionMode",
        permissionMode: "ask_every_time" as "auto_approve",
      }),
    ).toThrow("permissionMode must be auto_approve or requires_approval");

    stopOrchestratorRuntime();
  });
});

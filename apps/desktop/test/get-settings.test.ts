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

  test("returns workflow path, project meta, ACP config, and poll interval from workflow", async () => {
    const { getSettings, stopOrchestratorRuntime, workflowPath } = await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 45000
${demoAcpWorkflowBlock()}
---

Run the issue.
`);

    const settings = getSettings();

    expect(settings.workflowPath).toBe(workflowPath);
    expect(settings.workflowVersion).toEqual(expect.any(String));
    expect(settings.promptTemplate).toBe("Run the issue.");
    expect(settings.pollIntervalMs).toBe(45_000);
    expect(settings.pollIntervalSource).toBe("workflow");
    expect(settings.permissionMode).toBe("auto_approve");
    expect(settings.permissionModeSource).toBe("workflow");
    expect(settings.project).toEqual({
      id: "symphony-local",
      name: "symphony-local",
      slug: "symphony-local",
    });
    expect(settings.acp.command).toEqual(process.execPath);
    expect(settings.acp.args).toEqual([expect.stringContaining("demo-acp-server.mjs")]);
    expect(settings.status).toBe("idle");

    stopOrchestratorRuntime();
  });

  test("reflects poll interval override from controlRuntime", async () => {
    const { controlRuntime, getSettings, stopOrchestratorRuntime } = await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 30000
${demoAcpWorkflowBlock()}
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
${demoAcpWorkflowBlock(["  permission_mode: auto_approve"])}
---

Run the issue.
`);

    controlRuntime({ action: "setPermissionMode", permissionMode: "requires_approval" });
    const settings = getSettings();

    expect(settings.permissionMode).toBe("requires_approval");
    expect(settings.permissionModeSource).toBe("override");

    stopOrchestratorRuntime();
  });

  test("reads requires_approval permission mode from workflow", async () => {
    const { getSettings, stopOrchestratorRuntime } = await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 30000
${demoAcpWorkflowBlock(["  permission_mode: requires_approval"])}
---

Run the issue.
`);

    const settings = getSettings();

    expect(settings.permissionMode).toBe("requires_approval");
    expect(settings.permissionModeSource).toBe("workflow");

    stopOrchestratorRuntime();
  });

  test("reflects clearPermissionModeOverride through getSettings", async () => {
    const { controlRuntime, getSettings, stopOrchestratorRuntime } = await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 30000
${demoAcpWorkflowBlock(["  permission_mode: requires_approval"])}
---

Run the issue.
`);

    controlRuntime({ action: "setPermissionMode", permissionMode: "auto_approve" });
    expect(getSettings().permissionMode).toBe("auto_approve");
    expect(getSettings().permissionModeSource).toBe("override");

    controlRuntime({ action: "clearPermissionModeOverride" });
    const settings = getSettings();

    expect(settings.permissionMode).toBe("requires_approval");
    expect(settings.permissionModeSource).toBe("workflow");

    stopOrchestratorRuntime();
  });

  test("leaves permission mode on workflow source when poll interval is overridden", async () => {
    const { controlRuntime, getSettings, stopOrchestratorRuntime } = await loadRuntime(`---
project_id: symphony-local
poll_interval_ms: 30000
${demoAcpWorkflowBlock(["  permission_mode: requires_approval"])}
---

Run the issue.
`);

    controlRuntime({ action: "setPollInterval", pollIntervalMs: 12_000 });
    const settings = getSettings();

    expect(settings.pollIntervalSource).toBe("override");
    expect(settings.permissionMode).toBe("requires_approval");
    expect(settings.permissionModeSource).toBe("workflow");

    stopOrchestratorRuntime();
  });
});

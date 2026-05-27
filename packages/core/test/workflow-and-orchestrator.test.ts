import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  closeDatabase,
  createTrackerStore,
  migrateUp,
  openDatabase,
  seedProjectWithDefaultStates,
} from "@symphony/db";
import { OrchestratorService } from "@core/services/orchestrator-service";
import {
  RuntimeConfigService,
  validateRuntimeConfig,
} from "@core/services/runtime-config-service";
import { TrackerService } from "@core/services/tracker-service";
import { WorkflowLoaderService } from "@core/services/workflow-loader-service";
import { makeOrchestratorRuntimeConfig } from "./fixtures/runtime-config";

const tempDirs: string[] = [];

function dbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-core-orchestrator-test-"));
  tempDirs.push(dir);
  return path.join(dir, "orchestrator.sqlite");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("WorkflowLoaderService", () => {
  test("parses front matter and prompt body", () => {
    const loader = new WorkflowLoaderService();
    const definition = loader.loadFromText(`---
project_id: p1
poll_interval_ms: 20000
max_concurrency: 4
acp:
  mode: mock
---
# Runbook
Execute issue work safely.
`);

    expect(definition.config).toEqual({
      project_id: "p1",
      poll_interval_ms: 20000,
      max_concurrency: 4,
      acp: { mode: "mock" },
    });
    expect(definition.promptTemplate).toContain("Execute issue work safely.");
  });
});

describe("RuntimeConfigService", () => {
  test("resolves runtime config with defaults", () => {
    const configService = new RuntimeConfigService();
    const config = configService.toRuntimeConfig({
      config: {
        project_id: "p1",
        max_concurrency: 4,
      },
      promptTemplate: "Ship code",
    });

    expect(config.projectId).toBe("p1");
    expect(config.maxConcurrency).toBe(4);
    expect(config.pollIntervalMs).toBe(30000);
    expect(config.retryMaxBackoffMs).toBe(300000);
    expect(config.acp.mode).toBe("mock");
    expect(config.acp.permissionMode).toBe("auto_approve");
    expect(config.acp.command.length).toBeGreaterThan(0);
    expect(config.workspaceRoot).toBe(".symphony-workspaces");
    expect(config.hooks.timeoutMs).toBe(60000);
  });

  test("requires project_id in workflow config", () => {
    const configService = new RuntimeConfigService();
    expect(() =>
      configService.toRuntimeConfig({
        config: { poll_interval_ms: 10_000 },
        promptTemplate: "Ship code",
      }),
    ).toThrow("Missing required config: project_id");
  });

  test("resolves explicit subprocess acp settings", () => {
    const configService = new RuntimeConfigService();
    const config = configService.toRuntimeConfig({
      config: {
        project_id: "p2",
        acp: {
          mode: "subprocess",
          command: "bunx",
          args: ["acp-agent", "--stdio"],
          mock_completion_delay_ms: 500,
        },
        workspace_root: "./workspaces",
        hooks: {
          timeout_ms: 30_000,
        },
      },
      promptTemplate: "Ship code",
    });

    expect(config.acp.mode).toBe("subprocess");
    expect(config.acp.command).toBe("bunx");
    expect(config.acp.args).toEqual(["acp-agent", "--stdio"]);
    expect(config.acp.mockCompletionDelayMs).toBe(500);
    expect(config.workspaceRoot).toBe("./workspaces");
    expect(config.hooks.timeoutMs).toBe(30_000);
  });

  test("resolves permission_mode from acp block with auto_approve default", () => {
    const configService = new RuntimeConfigService();
    const defaultConfig = configService.toRuntimeConfig({
      config: {
        project_id: "p1",
        acp: { mode: "mock" },
      },
      promptTemplate: "Ship code",
    });
    expect(defaultConfig.acp.permissionMode).toBe("auto_approve");

    const autoApproveConfig = configService.toRuntimeConfig({
      config: {
        project_id: "p1",
        acp: {
          mode: "subprocess",
          permission_mode: "auto_approve",
        },
      },
      promptTemplate: "Ship code",
    });
    expect(autoApproveConfig.acp.permissionMode).toBe("auto_approve");

    const requiresApprovalConfig = configService.toRuntimeConfig({
      config: {
        project_id: "p1",
        acp: {
          mode: "mock",
          permission_mode: "requires_approval",
        },
      },
      promptTemplate: "Ship code",
    });
    expect(requiresApprovalConfig.acp.permissionMode).toBe("requires_approval");

    const invalidConfig = configService.toRuntimeConfig({
      config: {
        project_id: "p1",
        acp: {
          mode: "mock",
          permission_mode: "ask_every_time",
        },
      },
      promptTemplate: "Ship code",
    });
    expect(invalidConfig.acp.permissionMode).toBe("auto_approve");
  });
});

describe("validateRuntimeConfig", () => {
  test("accepts minimal valid workflow config", () => {
    const result = validateRuntimeConfig({
      config: {
        project_id: "p1",
        acp: { mode: "mock" },
      },
      promptTemplate: "Ship code",
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  test("reports missing project_id", () => {
    const result = validateRuntimeConfig({
      config: {
        acp: { mode: "mock" },
      },
      promptTemplate: "Ship code",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      { field: "project_id", message: "Missing required config: project_id" },
    ]);
  });

  test("reports missing acp.mode", () => {
    const result = validateRuntimeConfig({
      config: {
        project_id: "p1",
      },
      promptTemplate: "Ship code",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      { field: "acp.mode", message: "Missing required config: acp.mode" },
    ]);
  });

  test("reports invalid acp.mode", () => {
    const result = validateRuntimeConfig({
      config: {
        project_id: "p1",
        acp: { mode: "acp-cli" },
      },
      promptTemplate: "Ship code",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      {
        field: "acp.mode",
        message: "Invalid config: acp.mode must be mock or subprocess",
      },
    ]);
  });
});

describe("OrchestratorService", () => {
  test("dispatches eligible issues and avoids blocked issues", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project One", slug: "project-one" });

    const tracker = TrackerService.fromDatabase(db);
    tracker.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Blocked issue" });
    tracker.createIssue({
      id: "i2",
      projectId: "p1",
      identifier: "P1-2",
      title: "Dependency issue",
    });
    tracker.createIssue({ id: "i3", projectId: "p1", identifier: "P1-3", title: "Ready issue" });
    tracker.addDependency("i1", "i2");

    const store = createTrackerStore(db);
    const orchestrator = new OrchestratorService(
      store,
      makeOrchestratorRuntimeConfig({ maxConcurrency: 2 }),
    );

    const result = orchestrator.runPollCycle(new Date().toISOString());

    expect(result.dispatched.map((item) => item.issueId)).toContain("i3");
    expect(result.dispatched.map((item) => item.issueId)).toContain("i2");
    expect(result.dispatched.map((item) => item.issueId)).not.toContain("i1");
    expect(store.runAttempts.listRunningRunAttempts("p1")).toHaveLength(2);

    closeDatabase(db);
  });

  test("reconciles running attempts and cancels issues outside active categories", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project One", slug: "project-one" });

    const tracker = TrackerService.fromDatabase(db);
    tracker.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Will be done" });
    tracker.createIssue({ id: "i2", projectId: "p1", identifier: "P1-2", title: "Still active" });

    const store = createTrackerStore(db);
    const orchestrator = new OrchestratorService(
      store,
      makeOrchestratorRuntimeConfig({ maxConcurrency: 3 }),
    );

    orchestrator.runPollCycle(new Date().toISOString());
    tracker.transitionIssue("i1", "p1:done");

    const reconciliation = orchestrator.reconcileRunningAttempts();
    const i1Result = reconciliation.find((item) => item.issueId === "i1");
    const i2Result = reconciliation.find((item) => item.issueId === "i2");

    expect(i1Result?.action).toBe("cancelled");
    expect(i1Result?.reason).toBe("terminal");
    expect(i2Result?.action).toBe("kept");

    const running = store.runAttempts.listRunningRunAttempts("p1");
    expect(running.map((row) => row.issueId)).toEqual(["i2"]);

    closeDatabase(db);
  });
});

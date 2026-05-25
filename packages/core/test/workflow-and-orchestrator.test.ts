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
import { RuntimeConfigService } from "@core/services/runtime-config-service";
import { TrackerService } from "@core/services/tracker-service";
import { WorkflowLoaderService } from "@core/services/workflow-loader-service";

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
tracker:
  project_id: p1
orchestrator:
  poll_interval_ms: 20000
---
# Runbook
Execute issue work safely.
`);

    expect(definition.config).toEqual({
      tracker: { project_id: "p1" },
      orchestrator: { poll_interval_ms: 20000 },
    });
    expect(definition.promptTemplate).toContain("Execute issue work safely.");
  });
});

describe("RuntimeConfigService", () => {
  test("resolves runtime config with defaults", () => {
    const configService = new RuntimeConfigService();
    const config = configService.toRuntimeConfig({
      config: {
        tracker: { project_id: "p1" },
        orchestrator: { max_concurrency: 4 },
      },
      promptTemplate: "Ship code",
    });

    expect(config.projectId).toBe("p1");
    expect(config.tracker.kind).toBe("db");
    expect(config.maxConcurrency).toBe(4);
    expect(config.pollIntervalMs).toBe(30000);
    expect(config.runtimeAdapter.kind).toBe("mock-acp");
    expect(config.runtimeAdapter.acpCliCommand.length).toBeGreaterThan(0);
    expect(config.workspaceRoot).toBe(".symphony-workspaces");
    expect(config.hooks.timeoutMs).toBe(60000);
  });

  test("resolves explicit acp-cli runtime adapter settings", () => {
    const configService = new RuntimeConfigService();
    const config = configService.toRuntimeConfig({
      config: {
        tracker: { project_id: "p2" },
        runtime: {
          adapter_kind: "acp-cli",
          acp_cli_command: "bunx",
          acp_cli_args: ["acp-agent", "--stdio"],
        },
      },
      promptTemplate: "Ship code",
    });

    expect(config.runtimeAdapter.kind).toBe("acp-cli");
    expect(config.runtimeAdapter.acpCliCommand).toBe("bunx");
    expect(config.runtimeAdapter.acpCliArgs).toEqual(["acp-agent", "--stdio"]);
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
    const orchestrator = new OrchestratorService(store, {
      tracker: {
        kind: "db",
        linearApiUrl: "https://api.linear.app/graphql",
        linearTokenEnvVar: "LINEAR_API_TOKEN",
        linearTeamId: "default",
      },
      projectId: "p1",
      maxConcurrency: 2,
      pollIntervalMs: 30000,
      retryBaseDelayMs: 1000,
      retryMaxDelayMs: 30000,
      activeStateCategories: ["active", "backlog"],
      runtimeAdapter: {
        kind: "mock-acp",
        completionDelayMs: 1200,
        acpCliCommand: process.execPath,
        acpCliArgs: ["-e", "setTimeout(() => process.exit(0), 1200)"],
      },
      workspaceRoot: ".symphony-workspaces",
      hooks: {
        afterCreate: [],
        beforeAgentRun: [],
        afterRun: [],
        beforeRemove: [],
        timeoutMs: 60000,
      },
    });

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
    const orchestrator = new OrchestratorService(store, {
      tracker: {
        kind: "db",
        linearApiUrl: "https://api.linear.app/graphql",
        linearTokenEnvVar: "LINEAR_API_TOKEN",
        linearTeamId: "default",
      },
      projectId: "p1",
      maxConcurrency: 3,
      pollIntervalMs: 30000,
      retryBaseDelayMs: 1000,
      retryMaxDelayMs: 30000,
      activeStateCategories: ["active", "backlog"],
      runtimeAdapter: {
        kind: "mock-acp",
        completionDelayMs: 1200,
        acpCliCommand: process.execPath,
        acpCliArgs: ["-e", "setTimeout(() => process.exit(0), 1200)"],
      },
      workspaceRoot: ".symphony-workspaces",
      hooks: {
        afterCreate: [],
        beforeAgentRun: [],
        afterRun: [],
        beforeRemove: [],
        timeoutMs: 60000,
      },
    });

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

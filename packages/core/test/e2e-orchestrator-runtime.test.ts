import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
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
import { DbTrackerAdapter } from "@core/services/db-tracker-adapter";
import { OrchestratorService } from "@core/services/orchestrator-service";
import { RunLifecycleService } from "@core/services/run-lifecycle-service";
import { TrackerService } from "@core/services/tracker-service";
import { WorkspaceManagerService } from "@core/services/workspace-manager-service";
import { createTrackerAdapter } from "@core/services/create-tracker-adapter";
import type { RuntimeConfig } from "@core/types/workflow";

const tempDirs: string[] = [];

function makeRuntimeConfig(workspaceRoot: string): RuntimeConfig {
  return {
    tracker: {
      kind: "db",
      linearApiUrl: "https://api.linear.app/graphql",
      linearTokenEnvVar: "LINEAR_API_TOKEN",
      linearTeamId: "default",
    },
    projectId: "p1",
    pollIntervalMs: 1000,
    maxConcurrency: 2,
    retryBaseDelayMs: 100,
    retryMaxDelayMs: 3000,
    activeStateCategories: ["active", "backlog"],
    runtimeAdapter: {
      kind: "mock-acp",
      completionDelayMs: 50,
      acpCliCommand: process.execPath,
      acpCliArgs: ["-e", "setTimeout(() => process.exit(0), 50)"],
    },
    workspaceRoot,
    hooks: {
      afterCreate: [],
      beforeAgentRun: [],
      afterRun: [],
      beforeRemove: [],
      timeoutMs: 5000,
    },
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("orchestrator e2e integration", () => {
  test("dispatches lifecycle and supports tracker writes through adapter boundary", () => {
    const root = mkdtempSync(path.join(tmpdir(), "symphony-e2e-int-"));
    tempDirs.push(root);

    const dbPath = path.join(root, "runtime.sqlite");
    const db = openDatabase(dbPath);

    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project", slug: "project" });

    const store = createTrackerStore(db);
    const tracker = TrackerService.fromDatabase(db);
    tracker.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Ship feature" });

    const config = makeRuntimeConfig(path.join(root, "workspaces"));
    const readAdapter = new DbTrackerAdapter(store);
    const orchestrator = new OrchestratorService(store, config, readAdapter);

    const poll = orchestrator.runPollCycle(new Date().toISOString());
    expect(poll.dispatched).toHaveLength(1);

    const dispatched = poll.dispatched[0];
    if (!dispatched) throw new Error("Expected dispatch item");

    const lifecycle = new RunLifecycleService(store.runAttempts, store.agentSessions);
    lifecycle.attachSession({
      sessionId: "sess-1",
      runAttemptId: dispatched.runAttemptId,
      runtimeKind: "mock-acp",
      sessionRef: "acp://p1-1/1",
    });
    lifecycle.finishSession("sess-1", "succeeded");
    lifecycle.finishRun(dispatched.runAttemptId, "succeeded");

    const writeAdapter = createTrackerAdapter(store, config);
    writeAdapter.addIssueComment("i1", "handoff complete", "operator");
    writeAdapter.transitionIssue("i1", "p1:done", "operator");

    const run = store.runAttempts.getLatestRunAttempt("i1");
    expect(run?.status).toBe("succeeded");

    const comments = tracker.listComments("i1");
    expect(comments.length).toBe(1);
    expect(comments[0]?.body).toContain("handoff complete");

    const state = readAdapter.getIssueStateCategories(["i1"])["i1"];
    expect(state).toBe("terminal");

    closeDatabase(db);
  });

  test("workspace cleanup executes beforeRemove and removes workspace path", () => {
    const root = mkdtempSync(path.join(tmpdir(), "symphony-e2e-clean-"));
    tempDirs.push(root);

    const workspaceRoot = path.join(root, "workspaces");
    const markerPath = path.join(root, "before-remove-marker.txt");

    const manager = new WorkspaceManagerService(workspaceRoot, {
      afterCreate: [],
      beforeAgentRun: [],
      afterRun: [],
      beforeRemove: [
        `${process.execPath} -e "require('fs').writeFileSync('${markerPath}', 'removed')"`,
      ],
      timeoutMs: 5000,
    });

    const workspace = manager.ensureWorkspace("P1-9 hotfix");
    expect(existsSync(workspace.workspacePath)).toBe(true);

    manager.removeWorkspace("P1-9 hotfix");

    expect(existsSync(workspace.workspacePath)).toBe(false);
    expect(readFileSync(markerPath, "utf8")).toBe("removed");
  });
});

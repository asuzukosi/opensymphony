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
import { CandidateSelectionService } from "@core/services/candidate-selection-service";
import { OrchestratorService } from "@core/services/orchestrator-service";
import { RetryService } from "@core/services/retry-service";
import { RunLifecycleService } from "@core/services/run-lifecycle-service";
import { TrackerService } from "@core/services/tracker-service";

import { makeOrchestratorRuntimeConfig } from "./fixtures/runtime-config";

const tempDirs: string[] = [];

function dbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-orch-test-"));
  tempDirs.push(dir);
  return path.join(dir, "orch.sqlite");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("orchestrator groundwork services", () => {
  test("candidate selection filters blocked issues and respects maxCount", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project", slug: "project" });

    const tracker = TrackerService.fromDatabase(db);
    tracker.createIssue({
      id: "i1",
      projectId: "p1",
      identifier: "P1-1",
      title: "Candidate A",
      priority: 1,
    });
    tracker.createIssue({
      id: "i2",
      projectId: "p1",
      identifier: "P1-2",
      title: "Blocked B",
      priority: 2,
    });
    tracker.createIssue({
      id: "i3",
      projectId: "p1",
      identifier: "P1-3",
      title: "Dependency C",
      priority: 3,
    });

    tracker.addDependency("i2", "i3");

    const store = createTrackerStore(db);
    const service = new CandidateSelectionService(
      store.issues,
      store.dependencies,
      store.workflowStates,
      store.runAttempts,
    );

    const selected = service.select({ projectId: "p1", maxCount: 5 });

    expect(selected.map((s) => s.issueId)).toEqual(["i1", "i3"]);

    const eligible = service.listEligible("p1");
    expect(eligible.map((item) => item.issueId)).toEqual(["i1", "i3"]);
    expect(eligible.find((item) => item.issueId === "i2")).toBeUndefined();

    closeDatabase(db);
  });

  test("retry service schedules exponential backoff and pops due retries", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project", slug: "project" });

    const tracker = TrackerService.fromDatabase(db);
    tracker.createIssue({ id: "issue-x", projectId: "p1", identifier: "P1-X", title: "Retry X" });
    tracker.createIssue({ id: "issue-y", projectId: "p1", identifier: "P1-Y", title: "Retry Y" });

    const store = createTrackerStore(db);
    const retryService = new RetryService(store.retryQueue);

    const first = retryService.scheduleRetry({
      issueId: "issue-x",
      attemptNumber: 1,
      baseDelayMs: 1000,
      maxDelayMs: 8000,
      errorMessage: "fail-1",
    });

    const third = retryService.scheduleRetry({
      issueId: "issue-y",
      attemptNumber: 3,
      baseDelayMs: 1000,
      maxDelayMs: 8000,
      errorMessage: "fail-3",
    });

    expect(first.delayMs).toBe(1000);
    expect(third.delayMs).toBe(4000);

    const due = retryService.popDueRetries(new Date(Date.now() + 10_000).toISOString());
    expect(due).toHaveLength(2);

    const dueAgain = retryService.popDueRetries(new Date(Date.now() + 10_000).toISOString());
    expect(dueAgain).toHaveLength(0);

    closeDatabase(db);
  });

  test("run lifecycle persists attempts and sessions", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project", slug: "project" });

    const tracker = TrackerService.fromDatabase(db);
    tracker.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Run me" });

    const store = createTrackerStore(db);
    const runs = new RunLifecycleService(store.runAttempts, store.agentSessions);

    runs.startRun({ runAttemptId: "run-1", issueId: "i1", attemptNumber: 1 });
    runs.attachSession({
      sessionId: "sess-1",
      runAttemptId: "run-1",
      sessionRef: "11111111-1111-4111-8111-111111111111",
    });
    runs.finishSession("sess-1", "succeeded");
    runs.finishRun("run-1", "succeeded");

    const latest = store.runAttempts.getLatestRunAttempt("i1");
    const sessions = store.agentSessions.listSessionsByRunAttempt("run-1");

    expect(latest?.status).toBe("succeeded");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe("succeeded");
    expect(sessions[0].sessionRef).toBe("11111111-1111-4111-8111-111111111111");

    closeDatabase(db);
  });

  test("run lifecycle syncs agent session ref after attach", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project", slug: "project" });

    const tracker = TrackerService.fromDatabase(db);
    tracker.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Run me" });

    const store = createTrackerStore(db);
    const runs = new RunLifecycleService(store.runAttempts, store.agentSessions);

    runs.startRun({ runAttemptId: "run-1", issueId: "i1", attemptNumber: 1 });
    runs.attachSession({
      sessionId: "sess-1",
      runAttemptId: "run-1",
    });
    runs.syncSessionRef("sess-1", "22222222-2222-4222-8222-222222222222");

    const sessions = store.agentSessions.listSessionsByRunAttempt("run-1");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionRef).toBe("22222222-2222-4222-8222-222222222222");

    closeDatabase(db);
  });

  test("candidate selection excludes non-backlog states and succeeded attempts", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project", slug: "project" });

    const tracker = TrackerService.fromDatabase(db);
    tracker.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Todo issue" });
    tracker.createIssue({ id: "i2", projectId: "p1", identifier: "P1-2", title: "In progress issue" });
    tracker.createIssue({ id: "i3", projectId: "p1", identifier: "P1-3", title: "Succeeded once" });
    tracker.transitionIssue("i2", "p1:in_progress");
    tracker.transitionIssue("i3", "p1:human_review");

    const store = createTrackerStore(db);
    store.runAttempts.createRunAttempt({
      id: "i3:attempt:1",
      issueId: "i3",
      attemptNumber: 1,
      status: "succeeded",
    });

    const service = new CandidateSelectionService(
      store.issues,
      store.dependencies,
      store.workflowStates,
      store.runAttempts,
    );

    expect(service.listEligible("p1").map((item) => item.issueId)).toEqual(["i1"]);

    closeDatabase(db);
  });

  test("orchestrator moves issues to in progress on dispatch and human review on success", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project", slug: "project" });

    const tracker = TrackerService.fromDatabase(db);
    tracker.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Ship feature" });

    const store = createTrackerStore(db);
    const orchestrator = new OrchestratorService(
      store,
      makeOrchestratorRuntimeConfig({ projectId: "p1", maxConcurrency: 1 }),
    );

    const poll = orchestrator.runPollCycle(new Date().toISOString());
    expect(poll.dispatched).toHaveLength(1);

    const issueAfterDispatch = store.issues.getIssueById("i1");
    expect(issueAfterDispatch?.workflowStateId).toBe("p1:in_progress");

    orchestrator.markAttemptSucceeded("i1");

    const issueAfterSuccess = store.issues.getIssueById("i1");
    expect(issueAfterSuccess?.workflowStateId).toBe("p1:human_review");
    expect(serviceListEligible(store, "p1")).toEqual([]);

    closeDatabase(db);
  });
});

function serviceListEligible(store: ReturnType<typeof createTrackerStore>, projectId: string): string[] {
  const service = new CandidateSelectionService(
    store.issues,
    store.dependencies,
    store.workflowStates,
    store.runAttempts,
  );
  return service.listEligible(projectId).map((item) => item.issueId);
}

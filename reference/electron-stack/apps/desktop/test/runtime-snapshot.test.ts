import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { demoAcpWorkflowBlock } from "./fixtures/demo-acp-workflow";
import {
  closeDatabase,
  createTrackerStore,
  migrateUp,
  openDatabase,
  seedProjectWithDefaultStates,
} from "@symphony/db";
import { RunLifecycleService } from "@symphony/core";
import {
  buildAgentTotals,
  buildRunningEntries,
  buildRecentFinishedEntries,
  buildRetryingEntries,
  buildRuntimeSnapshot,
  enrichRunningEntries,
  resolveWorkflowValidationError,
} from "../src/runtime/runtime-snapshot";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function openTestStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-runtime-snapshot-"));
  tempDirs.push(dir);
  const db = openDatabase(path.join(dir, "test.sqlite"));
  migrateUp(db);
  seedProjectWithDefaultStates(db, { id: "p1", name: "Project One", slug: "project-one" });
  return { db, store: createTrackerStore(db) };
}

describe("buildRunningEntries", () => {
  test("joins running attempts with active agent sessions", () => {
    const { db, store } = openTestStore();
    store.issues.createIssue({
      id: "i1",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-1",
      title: "Running issue",
      description: null,
      priority: null,
    });

    const lifecycle = new RunLifecycleService(store.runAttempts, store.agentSessions);
    lifecycle.startRun({ runAttemptId: "run-1", issueId: "i1", attemptNumber: 1 });
    lifecycle.attachSession({
      sessionId: "sess-1",
      runAttemptId: "run-1",
      sessionRef: "11111111-1111-4111-8111-111111111111",
    });

    expect(buildRunningEntries(store, "p1")).toEqual([
      {
        runAttemptId: "run-1",
        issueId: "i1",
        identifier: "P1-1",
        attemptNumber: 1,
        startedAt: expect.any(String),
        sessionId: "sess-1",
        sessionStatus: "running",
        phase: null,
        lastEventSummary: null,
        paused: false,
      },
    ]);

    closeDatabase(db);
  });

  test("returns null session fields when attempt has no active session", () => {
    const { db, store } = openTestStore();
    store.issues.createIssue({
      id: "i2",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-2",
      title: "Attempt without session",
      description: null,
      priority: null,
    });

    const lifecycle = new RunLifecycleService(store.runAttempts, store.agentSessions);
    lifecycle.startRun({ runAttemptId: "run-2", issueId: "i2", attemptNumber: 1 });

    expect(buildRunningEntries(store, "p1")).toEqual([
      {
        runAttemptId: "run-2",
        issueId: "i2",
        identifier: "P1-2",
        attemptNumber: 1,
        startedAt: expect.any(String),
        sessionId: null,
        sessionStatus: null,
        phase: null,
        lastEventSummary: null,
        paused: false,
      },
    ]);

    closeDatabase(db);
  });
});

describe("enrichRunningEntries", () => {
  test("fills phase and last event summary from session observability", () => {
    const running = buildRunningEntries(
      {
        runAttempts: {
          listRunningRunSnapshots: () => [
            {
              runAttemptId: "run-1",
              issueId: "i1",
              identifier: "P1-1",
              attemptNumber: 1,
              startedAt: "2026-01-01T00:00:00.000Z",
              sessionId: "sess-1",
              sessionStatus: "running",
            },
          ],
        },
      } as never,
      "p1",
    );

    expect(
      enrichRunningEntries(running, {
        getSessionPhase: (sessionId) => (sessionId === "sess-1" ? "streaming" : null),
        getLastEventSummary: (sessionId) =>
          sessionId === "sess-1" ? "agent_message_chunk" : null,
        isSessionPaused: (sessionId) => sessionId === "sess-1",
      }),
    ).toEqual([
      {
        runAttemptId: "run-1",
        issueId: "i1",
        identifier: "P1-1",
        attemptNumber: 1,
        startedAt: "2026-01-01T00:00:00.000Z",
        sessionId: "sess-1",
        sessionStatus: "running",
        phase: "streaming",
        lastEventSummary: "agent_message_chunk",
        paused: true,
      },
    ]);
  });
});

describe("buildRetryingEntries", () => {
  test("joins retry queue rows with issue identifiers for the project", () => {
    const { db, store } = openTestStore();
    store.issues.createIssue({
      id: "i3",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-3",
      title: "Retry issue",
      description: null,
      priority: null,
    });

    store.retryQueue.upsertRetry({
      issueId: "i3",
      attemptNumber: 2,
      dueAt: "2026-05-26T12:00:00.000Z",
      errorMessage: "mock failure",
    });

    expect(buildRetryingEntries(store, "p1")).toEqual([
      {
        issueId: "i3",
        identifier: "P1-3",
        attemptNumber: 2,
        dueAt: "2026-05-26T12:00:00.000Z",
        errorMessage: "mock failure",
      },
    ]);

    closeDatabase(db);
  });

  test("scopes retries to the configured project", () => {
    const { db, store } = openTestStore();
    seedProjectWithDefaultStates(db, { id: "p2", name: "Project Two", slug: "project-two" });

    store.issues.createIssue({
      id: "i4",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-4",
      title: "Project one retry",
      description: null,
      priority: null,
    });
    store.issues.createIssue({
      id: "i5",
      projectId: "p2",
      workflowStateId: "p2:todo",
      identifier: "P2-1",
      title: "Project two retry",
      description: null,
      priority: null,
    });

    store.retryQueue.upsertRetry({
      issueId: "i4",
      attemptNumber: 1,
      dueAt: "2026-05-26T12:00:00.000Z",
      errorMessage: null,
    });
    store.retryQueue.upsertRetry({
      issueId: "i5",
      attemptNumber: 1,
      dueAt: "2026-05-26T13:00:00.000Z",
      errorMessage: null,
    });

    expect(buildRetryingEntries(store, "p1")).toEqual([
      {
        issueId: "i4",
        identifier: "P1-4",
        attemptNumber: 1,
        dueAt: "2026-05-26T12:00:00.000Z",
        errorMessage: null,
      },
    ]);

    closeDatabase(db);
  });
});

describe("buildAgentTotals", () => {
  test("counts active sessions with a running session id", () => {
    expect(
      buildAgentTotals([
        {
          runAttemptId: "run-1",
          issueId: "i1",
          identifier: "P1-1",
          attemptNumber: 1,
          startedAt: "2026-01-01T00:00:00.000Z",
          sessionId: "sess-1",
          sessionStatus: "running",
          phase: null,
          lastEventSummary: null,
          paused: false,
        },
        {
          runAttemptId: "run-2",
          issueId: "i2",
          identifier: "P1-2",
          attemptNumber: 1,
          startedAt: "2026-01-01T00:00:00.000Z",
          sessionId: "sess-2",
          sessionStatus: "running",
          phase: null,
          lastEventSummary: null,
          paused: false,
        },
        {
          runAttemptId: "run-3",
          issueId: "i3",
          identifier: "P1-3",
          attemptNumber: 1,
          startedAt: "2026-01-01T00:00:00.000Z",
          sessionId: "sess-3",
          sessionStatus: "running",
          phase: null,
          lastEventSummary: null,
          paused: false,
        },
        {
          runAttemptId: "run-4",
          issueId: "i4",
          identifier: "P1-4",
          attemptNumber: 1,
          startedAt: "2026-01-01T00:00:00.000Z",
          sessionId: null,
          sessionStatus: null,
          phase: null,
          lastEventSummary: null,
          paused: false,
        },
      ]),
    ).toEqual({
      activeSessions: 3,
    });
  });
});

describe("resolveWorkflowValidationError", () => {
  test("returns null for valid workflow config", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-valid-"));
    tempDirs.push(dir);
    const workflowPath = path.join(dir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
${demoAcpWorkflowBlock()}
---

Run the issue.
`,
    );

    expect(resolveWorkflowValidationError(workflowPath)).toBeNull();
  });

  test("returns formatted errors for invalid workflow config", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-invalid-"));
    tempDirs.push(dir);
    const workflowPath = path.join(dir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
poll_interval_ms: 1000
---

Run the issue.
`,
    );

    expect(resolveWorkflowValidationError(workflowPath)).toBe(
      "Missing required config: project_id; Missing required config: acp.command",
    );
  });
});

describe("buildRecentFinishedEntries", () => {
  test("maps latest finished run attempts for the project", () => {
    const { db, store } = openTestStore();

    store.issues.createIssue({
      id: "i1",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-1",
      title: "Finished issue",
      description: null,
      priority: null,
    });

    store.runAttempts.createRunAttempt({
      id: "run-finished",
      issueId: "i1",
      attemptNumber: 1,
      status: "running",
    });
    store.runAttempts.updateRunAttemptStatus("run-finished", "succeeded");
    db.prepare(`UPDATE run_attempts SET finished_at = ? WHERE id = ?`).run(
      "2026-01-01T00:02:00.000Z",
      "run-finished",
    );

    expect(buildRecentFinishedEntries(store, "p1")).toEqual([
      {
        runAttemptId: "run-finished",
        issueId: "i1",
        identifier: "P1-1",
        attemptNumber: 1,
        status: "succeeded",
        finishedAt: "2026-01-01T00:02:00.000Z",
        errorMessage: null,
        reviewStatus: "pending_review",
      },
    ]);

    closeDatabase(db);
  });
});

function writeValidWorkflow(dir: string, projectId = "p1") {
  const workflowPath = path.join(dir, "WORKFLOW.md");
  writeFileSync(
    workflowPath,
    `---
project_id: ${projectId}
${demoAcpWorkflowBlock()}
---

Run the issue.
`,
  );
  return workflowPath;
}

function seedFinishedRun(
  store: ReturnType<typeof openTestStore>["store"],
  db: ReturnType<typeof openTestStore>["db"],
  input: {
    runAttemptId: string;
    issueId: string;
    identifier: string;
    finishedAt: string;
    status?: "succeeded" | "failed" | "cancelled";
    errorMessage?: string | null;
  },
) {
  store.issues.createIssue({
    id: input.issueId,
    projectId: "p1",
    workflowStateId: "p1:done",
    identifier: input.identifier,
    title: "Finished issue",
    description: null,
    priority: null,
  });
  store.runAttempts.createRunAttempt({
    id: input.runAttemptId,
    issueId: input.issueId,
    attemptNumber: 1,
    status: "running",
  });
  store.runAttempts.updateRunAttemptStatus(
    input.runAttemptId,
    input.status ?? "succeeded",
  );
  db.prepare(`UPDATE run_attempts SET finished_at = ?, error_message = ? WHERE id = ?`).run(
    input.finishedAt,
    input.errorMessage ?? null,
    input.runAttemptId,
  );
}

describe("buildRuntimeSnapshot", () => {
  test("assembles full RuntimeStateSnapshot shape from seeded db fixture", () => {
    const { db, store } = openTestStore();
    const dir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-snapshot-"));
    tempDirs.push(dir);
    const workflowPath = writeValidWorkflow(dir);

    store.issues.createIssue({
      id: "i1",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-1",
      title: "Running issue",
      description: null,
      priority: null,
    });

    const lifecycle = new RunLifecycleService(store.runAttempts, store.agentSessions);
    lifecycle.startRun({ runAttemptId: "run-1", issueId: "i1", attemptNumber: 1 });
    lifecycle.attachSession({
      sessionId: "sess-1",
      runAttemptId: "run-1",
      sessionRef: "11111111-1111-4111-8111-111111111111",
    });

    store.retryQueue.upsertRetry({
      issueId: "i1",
      attemptNumber: 2,
      dueAt: "2026-05-26T12:00:00.000Z",
      errorMessage: "retry me",
    });

    seedFinishedRun(store, db, {
      runAttemptId: "run-finished",
      issueId: "i3",
      identifier: "P1-3",
      finishedAt: "2026-01-01T00:02:00.000Z",
    });

    const state = {
      status: "running" as const,
      workflowPath,
      workflowVersion: "1",
      workflowLastReloadedAt: "2026-05-26T00:00:00.000Z",
      startedAt: "2026-05-26T00:00:00.000Z",
      pollIntervalMs: 30_000,
      pollIntervalSource: "workflow" as const,
      nextTickAt: null,
      tickCount: 3,
      lastTickAt: "2026-05-26T00:01:00.000Z",
      lastDispatchedCount: 1,
      lastDeferredCount: 0,
      lastCancelledCount: 0,
      lastAction: "tick_completed",
      lastError: null,
    };
    const candidates = [
      {
        issueId: "i2",
        identifier: "P1-2",
        title: "Candidate",
        priority: null,
        stateCategory: "backlog",
      },
    ];
    const recentEvents = [
      {
        action: "tick_completed",
        issueId: null,
        payloadJson: null,
        createdAt: "2026-05-26T00:01:00.000Z",
      },
    ];

    const snapshot = buildRuntimeSnapshot({
      store,
      projectId: "p1",
      state,
      candidates,
      recentEvents,
    });

    expect(snapshot).toEqual({
      generatedAt: expect.any(String),
      ...state,
      validationError: null,
      counts: { running: 1, retrying: 1, candidates: 1 },
      agentTotals: { activeSessions: 1 },
      running: [
        {
          runAttemptId: "run-1",
          issueId: "i1",
          identifier: "P1-1",
          attemptNumber: 1,
          startedAt: expect.any(String),
          sessionId: "sess-1",
          sessionStatus: "running",
          phase: null,
          lastEventSummary: null,
          paused: false,
        },
      ],
      retrying: [
        {
          issueId: "i1",
          identifier: "P1-1",
          attemptNumber: 2,
          dueAt: "2026-05-26T12:00:00.000Z",
          errorMessage: "retry me",
        },
      ],
      recentFinished: [
        {
          runAttemptId: "run-finished",
          issueId: "i3",
          identifier: "P1-3",
          attemptNumber: 1,
          status: "succeeded",
          finishedAt: "2026-01-01T00:02:00.000Z",
          errorMessage: null,
          reviewStatus: "approved",
        },
      ],
      candidates,
      recentEvents,
    });

    closeDatabase(db);
  });

  test("surfaces workflow validation errors on the snapshot", () => {
    const { db, store } = openTestStore();
    const dir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-invalid-snapshot-"));
    tempDirs.push(dir);
    const workflowPath = path.join(dir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
poll_interval_ms: 1000
---

Run the issue.
`,
    );

    const snapshot = buildRuntimeSnapshot({
      store,
      projectId: "p1",
      state: {
        status: "idle",
        workflowPath,
        workflowVersion: null,
        workflowLastReloadedAt: null,
        startedAt: null,
        pollIntervalMs: 30_000,
        pollIntervalSource: "workflow",
        nextTickAt: null,
        tickCount: 0,
        lastTickAt: null,
        lastDispatchedCount: 0,
        lastDeferredCount: 0,
        lastCancelledCount: 0,
        lastAction: null,
        lastError: null,
      },
      candidates: [],
      recentEvents: [],
    });

    expect(snapshot.validationError).toBe(
      "Missing required config: project_id; Missing required config: acp.command",
    );
    expect(snapshot.counts).toEqual({ running: 0, retrying: 0, candidates: 0 });
    expect(snapshot.agentTotals).toEqual({ activeSessions: 0 });

    closeDatabase(db);
  });
});

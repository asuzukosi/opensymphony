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
} from "@/index";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function openTestStore() {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-issue-repo-"));
  tempDirs.push(dir);
  const db = openDatabase(path.join(dir, "test.sqlite"));
  migrateUp(db);
  seedProjectWithDefaultStates(db, { id: "p1", name: "Project One", slug: "project-one" });
  return { db, store: createTrackerStore(db) };
}

describe("listIssuesGroupedByWorkflowState", () => {
  test("returns workflow columns ordered by position with grouped issues", () => {
    const { db, store } = openTestStore();

    store.issues.createIssue({
      id: "i1",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-1",
      title: "Todo issue",
      description: null,
      priority: 2,
    });
    store.issues.createIssue({
      id: "i2",
      projectId: "p1",
      workflowStateId: "p1:in_progress",
      identifier: "P1-2",
      title: "Active issue",
      description: null,
      priority: 1,
    });
    store.issues.createIssue({
      id: "i3",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-3",
      title: "Higher priority todo",
      description: null,
      priority: 1,
    });

    const columns = store.issues.listIssuesGroupedByWorkflowState("p1");

    expect(columns.map((column) => column.workflowStateId)).toEqual([
      "p1:todo",
      "p1:in_progress",
      "p1:human_review",
      "p1:done",
    ]);
    expect(columns.map((column) => column.workflowStateName)).toEqual([
      "Todo",
      "In Progress",
      "Human Review",
      "Done",
    ]);
    expect(columns.map((column) => column.position)).toEqual([10, 20, 30, 40]);
    expect(columns.map((column) => column.category)).toEqual([
      "backlog",
      "active",
      "active",
      "terminal",
    ]);
    expect(columns[0]?.issues.map((issue) => issue.id)).toEqual(["i3", "i1"]);
    expect(columns[1]?.issues.map((issue) => issue.id)).toEqual(["i2"]);
    expect(columns[2]?.issues).toEqual([]);
    expect(columns[3]?.issues).toEqual([]);

    closeDatabase(db);
  });

  test("returns empty list for unknown project", () => {
    const { db, store } = openTestStore();

    expect(store.issues.listIssuesGroupedByWorkflowState("missing")).toEqual([]);

    closeDatabase(db);
  });

  test("scopes issues to the requested project without changing column order", () => {
    const { db, store } = openTestStore();
    seedProjectWithDefaultStates(db, { id: "p2", name: "Project Two", slug: "project-two" });

    store.issues.createIssue({
      id: "i1",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-1",
      title: "Project one todo",
      description: null,
      priority: null,
    });
    store.issues.createIssue({
      id: "i2",
      projectId: "p2",
      workflowStateId: "p2:in_progress",
      identifier: "P2-1",
      title: "Project two active",
      description: null,
      priority: null,
    });

    const columns = store.issues.listIssuesGroupedByWorkflowState("p1");

    expect(columns.map((column) => column.workflowStateId)).toEqual([
      "p1:todo",
      "p1:in_progress",
      "p1:human_review",
      "p1:done",
    ]);
    expect(columns[0]?.issues.map((issue) => issue.id)).toEqual(["i1"]);
    expect(columns[1]?.issues).toEqual([]);
    expect(columns[2]?.issues).toEqual([]);
    expect(columns[3]?.issues).toEqual([]);

    closeDatabase(db);
  });
});

describe("getIssueDetail", () => {
  test("joins issue, workflow state, comments, attempts, and sessions", () => {
    const { db, store } = openTestStore();

    store.issues.createIssue({
      id: "i1",
      projectId: "p1",
      workflowStateId: "p1:in_progress",
      identifier: "P1-1",
      title: "Detail issue",
      description: "details here",
      priority: 2,
    });

    store.comments.addComment({
      id: "c1",
      issueId: "i1",
      body: "first comment",
      authorId: "user-1",
    });
    store.comments.addComment({
      id: "c2",
      issueId: "i1",
      body: "second comment",
      authorId: null,
    });

    store.runAttempts.createRunAttempt({
      id: "run-1",
      issueId: "i1",
      attemptNumber: 1,
      status: "succeeded",
    });
    db.prepare(`UPDATE run_attempts SET started_at = ? WHERE id = ?`).run(
      "2026-01-01T00:00:00.000Z",
      "run-1",
    );
    store.agentSessions.createSession({
      id: "sess-1",
      runAttemptId: "run-1",
      sessionRef: "11111111-1111-4111-8111-111111111111",
      status: "succeeded",
    });
    db.prepare(`UPDATE agent_sessions SET finished_at = ? WHERE id = ?`).run(
      "2026-01-01T00:01:00.000Z",
      "sess-1",
    );

    store.runAttempts.createRunAttempt({
      id: "run-2",
      issueId: "i1",
      attemptNumber: 2,
      status: "running",
    });
    db.prepare(`UPDATE run_attempts SET started_at = ? WHERE id = ?`).run(
      "2026-01-02T00:00:00.000Z",
      "run-2",
    );
    store.agentSessions.createSession({
      id: "sess-2",
      runAttemptId: "run-2",
      sessionRef: "22222222-2222-4222-8222-222222222222",
      status: "running",
    });

    const detail = store.issues.getIssueDetail("i1");

    expect(detail).toMatchObject({
      issueId: "i1",
      projectId: "p1",
      identifier: "P1-1",
      title: "Detail issue",
      description: "details here",
      priority: 2,
      workflowStateId: "p1:in_progress",
      workflowStateName: "In Progress",
    });
    expect(detail?.comments).toEqual([
      {
        id: "c1",
        body: "first comment",
        authorId: "user-1",
        createdAt: expect.any(String),
      },
      {
        id: "c2",
        body: "second comment",
        authorId: null,
        createdAt: expect.any(String),
      },
    ]);
    expect(detail?.attempts).toHaveLength(2);
    expect(detail?.attempts[0]).toMatchObject({
      runAttemptId: "run-2",
      attemptNumber: 2,
      status: "running",
      sessions: [
        {
          sessionId: "sess-2",
          sessionRef: "22222222-2222-4222-8222-222222222222",
          status: "running",
          startedAt: expect.any(String),
          finishedAt: null,
        },
      ],
    });
    expect(detail?.attempts[1]).toMatchObject({
      runAttemptId: "run-1",
      attemptNumber: 1,
      status: "succeeded",
      sessions: [
        {
          sessionId: "sess-1",
          sessionRef: "11111111-1111-4111-8111-111111111111",
          status: "succeeded",
          startedAt: expect.any(String),
          finishedAt: "2026-01-01T00:01:00.000Z",
          events: [],
        },
      ],
    });

    closeDatabase(db);
  });

  test("includes session events on each session", () => {
    const { db, store } = openTestStore();

    store.issues.createIssue({
      id: "i1",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-1",
      title: "Events issue",
      description: null,
      priority: null,
    });
    store.runAttempts.createRunAttempt({
      id: "run-1",
      issueId: "i1",
      attemptNumber: 1,
      status: "succeeded",
    });
    store.agentSessions.createSession({
      id: "sess-1",
      runAttemptId: "run-1",
      status: "succeeded",
    });
    store.sessionEvents.append({
      id: "event-1",
      sessionId: "sess-1",
      kind: "prompt",
      payload: { text: "run task" },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.sessionEvents.append({
      id: "event-2",
      sessionId: "sess-1",
      kind: "stream_chunk",
      payload: { chunk: "hello" },
      createdAt: "2026-01-01T00:00:01.000Z",
    });

    const detail = store.issues.getIssueDetail("i1");

    expect(detail?.attempts[0]?.sessions[0]?.events).toEqual([
      {
        id: "event-1",
        sessionId: "sess-1",
        kind: "prompt",
        payloadJson: JSON.stringify({ text: "run task" }),
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "event-2",
        sessionId: "sess-1",
        kind: "stream_chunk",
        payloadJson: JSON.stringify({ chunk: "hello" }),
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    ]);

    closeDatabase(db);
  });

  test("returns null for missing issue", () => {
    const { db, store } = openTestStore();

    expect(store.issues.getIssueDetail("missing")).toBeNull();

    closeDatabase(db);
  });

  test("respects attempt limit", () => {
    const { db, store } = openTestStore();

    store.issues.createIssue({
      id: "i1",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-1",
      title: "Limited attempts",
      description: null,
      priority: null,
    });

    store.runAttempts.createRunAttempt({
      id: "run-1",
      issueId: "i1",
      attemptNumber: 1,
      status: "failed",
      errorMessage: "fail 1",
    });
    db.prepare(`UPDATE run_attempts SET started_at = ? WHERE id = ?`).run(
      "2026-01-01T00:00:00.000Z",
      "run-1",
    );
    store.runAttempts.createRunAttempt({
      id: "run-2",
      issueId: "i1",
      attemptNumber: 2,
      status: "failed",
      errorMessage: "fail 2",
    });
    db.prepare(`UPDATE run_attempts SET started_at = ? WHERE id = ?`).run(
      "2026-01-02T00:00:00.000Z",
      "run-2",
    );
    store.runAttempts.createRunAttempt({
      id: "run-3",
      issueId: "i1",
      attemptNumber: 3,
      status: "running",
    });
    db.prepare(`UPDATE run_attempts SET started_at = ? WHERE id = ?`).run(
      "2026-01-03T00:00:00.000Z",
      "run-3",
    );

    expect(store.issues.getIssueDetail("i1", 1)?.attempts).toHaveLength(1);
    expect(store.issues.getIssueDetail("i1", 1)?.attempts[0]?.runAttemptId).toBe("run-3");

    closeDatabase(db);
  });
});

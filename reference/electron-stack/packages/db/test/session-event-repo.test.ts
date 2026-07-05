import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  closeDatabase,
  createTrackerStore,
  migrateUp,
  openDatabase,
  SESSION_EVENT_TAIL_CAP,
  seedProjectWithDefaultStates,
} from "@/index";

const tempDirs: string[] = [];

function createDbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-session-events-"));
  tempDirs.push(dir);
  return path.join(dir, "test.sqlite");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("session event repo", () => {
  test("appends and lists events in chronological order", () => {
    const db = openDatabase(createDbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, {
      id: "project-1",
      name: "Symphony",
      slug: "symphony",
    });
    const store = createTrackerStore(db);

    store.issues.createIssue({
      id: "issue-1",
      projectId: "project-1",
      workflowStateId: "project-1:todo",
      identifier: "ISSUE-1",
      title: "Test issue",
      description: null,
      priority: null,
    });
    store.runAttempts.createRunAttempt({
      id: "run-1",
      issueId: "issue-1",
      attemptNumber: 1,
      status: "running",
    });
    store.agentSessions.createSession({
      id: "session-1",
      runAttemptId: "run-1",
      status: "running",
    });

    store.sessionEvents.append({
      id: "event-1",
      sessionId: "session-1",
      kind: "prompt",
      payload: { text: "hello" },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.sessionEvents.append({
      id: "event-2",
      sessionId: "session-1",
      kind: "stream_chunk",
      payload: { chunk: "world" },
      createdAt: "2026-01-01T00:00:01.000Z",
    });

    expect(store.sessionEvents.listBySessionId("session-1")).toEqual([
      {
        id: "event-1",
        sessionId: "session-1",
        kind: "prompt",
        payloadJson: JSON.stringify({ text: "hello" }),
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "event-2",
        sessionId: "session-1",
        kind: "stream_chunk",
        payloadJson: JSON.stringify({ chunk: "world" }),
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    ]);

    closeDatabase(db);
  });

  test("truncates to the newest tail cap per session", () => {
    const db = openDatabase(createDbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, {
      id: "project-1",
      name: "Symphony",
      slug: "symphony",
    });
    const store = createTrackerStore(db);

    store.issues.createIssue({
      id: "issue-1",
      projectId: "project-1",
      workflowStateId: "project-1:todo",
      identifier: "ISSUE-1",
      title: "Test issue",
      description: null,
      priority: null,
    });
    store.runAttempts.createRunAttempt({
      id: "run-1",
      issueId: "issue-1",
      attemptNumber: 1,
      status: "running",
    });
    store.agentSessions.createSession({
      id: "session-1",
      runAttemptId: "run-1",
      status: "running",
    });

    for (let index = 0; index < SESSION_EVENT_TAIL_CAP + 5; index += 1) {
      store.sessionEvents.append({
        sessionId: "session-1",
        kind: "stream_chunk",
        payload: { index },
        createdAt: new Date(Date.parse("2026-01-01T00:00:00.000Z") + index * 1000).toISOString(),
      });
    }

    const events = store.sessionEvents.listBySessionId("session-1");
    expect(events).toHaveLength(SESSION_EVENT_TAIL_CAP);
    expect(JSON.parse(events[0]?.payloadJson ?? "{}")).toEqual({ index: 5 });
    expect(JSON.parse(events.at(-1)?.payloadJson ?? "{}")).toEqual({
      index: SESSION_EVENT_TAIL_CAP + 4,
    });

    closeDatabase(db);
  });

  test("returns an empty list for unknown sessions", () => {
    const db = openDatabase(createDbPath());
    migrateUp(db);
    const store = createTrackerStore(db);

    expect(store.sessionEvents.listBySessionId("missing-session")).toEqual([]);

    closeDatabase(db);
  });

  test("generates ids and serializes payloads on append", () => {
    const db = openDatabase(createDbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, {
      id: "project-1",
      name: "Symphony",
      slug: "symphony",
    });
    const store = createTrackerStore(db);

    store.issues.createIssue({
      id: "issue-1",
      projectId: "project-1",
      workflowStateId: "project-1:todo",
      identifier: "ISSUE-1",
      title: "Test issue",
      description: null,
      priority: null,
    });
    store.runAttempts.createRunAttempt({
      id: "run-1",
      issueId: "issue-1",
      attemptNumber: 1,
      status: "running",
    });
    store.agentSessions.createSession({
      id: "session-1",
      runAttemptId: "run-1",
      status: "running",
    });

    const row = store.sessionEvents.append({
      sessionId: "session-1",
      kind: "error",
      payload: { message: "boom" },
      createdAt: "2026-01-01T00:00:02.000Z",
    });

    expect(row.id).toEqual(expect.any(String));
    expect(row).toEqual({
      id: row.id,
      sessionId: "session-1",
      kind: "error",
      payloadJson: JSON.stringify({ message: "boom" }),
      createdAt: "2026-01-01T00:00:02.000Z",
    });

    closeDatabase(db);
  });

  test("applies tail cap independently per session", () => {
    const db = openDatabase(createDbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, {
      id: "project-1",
      name: "Symphony",
      slug: "symphony",
    });
    const store = createTrackerStore(db);

    store.issues.createIssue({
      id: "issue-1",
      projectId: "project-1",
      workflowStateId: "project-1:todo",
      identifier: "ISSUE-1",
      title: "Test issue",
      description: null,
      priority: null,
    });
    store.runAttempts.createRunAttempt({
      id: "run-1",
      issueId: "issue-1",
      attemptNumber: 1,
      status: "running",
    });
    store.agentSessions.createSession({
      id: "session-a",
      runAttemptId: "run-1",
      status: "running",
    });
    store.agentSessions.createSession({
      id: "session-b",
      runAttemptId: "run-1",
      status: "running",
    });

    for (let index = 0; index < SESSION_EVENT_TAIL_CAP + 3; index += 1) {
      store.sessionEvents.append({
        sessionId: "session-a",
        kind: "stream_chunk",
        payload: { index },
        createdAt: new Date(Date.parse("2026-01-01T00:00:00.000Z") + index * 1000).toISOString(),
      });
    }

    store.sessionEvents.append({
      sessionId: "session-b",
      kind: "prompt",
      payload: { text: "only event" },
      createdAt: "2026-02-01T00:00:00.000Z",
    });

    expect(store.sessionEvents.listBySessionId("session-a")).toHaveLength(SESSION_EVENT_TAIL_CAP);
    expect(store.sessionEvents.listBySessionId("session-b")).toHaveLength(1);
    expect(JSON.parse(store.sessionEvents.listBySessionId("session-b")[0]?.payloadJson ?? "{}")).toEqual({
      text: "only event",
    });

    closeDatabase(db);
  });
});

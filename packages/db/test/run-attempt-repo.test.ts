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
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-run-attempt-repo-"));
  tempDirs.push(dir);
  const db = openDatabase(path.join(dir, "test.sqlite"));
  migrateUp(db);
  seedProjectWithDefaultStates(db, { id: "p1", name: "Project One", slug: "project-one" });
  return { db, store: createTrackerStore(db) };
}

describe("run attempt repo", () => {
  test("listRecentFinishedRunSnapshots returns latest finished attempts", () => {
    const { db, store } = openTestStore();

    store.issues.createIssue({
      id: "i1",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-1",
      title: "First issue",
      description: null,
      priority: null,
    });
    store.issues.createIssue({
      id: "i2",
      projectId: "p1",
      workflowStateId: "p1:todo",
      identifier: "P1-2",
      title: "Second issue",
      description: null,
      priority: null,
    });

    store.runAttempts.createRunAttempt({
      id: "run-1",
      issueId: "i1",
      attemptNumber: 1,
      status: "running",
    });
    store.runAttempts.updateRunAttemptStatus("run-1", "succeeded");
    db.prepare(`UPDATE run_attempts SET finished_at = ? WHERE id = ?`).run(
      "2026-01-01T00:01:00.000Z",
      "run-1",
    );

    store.runAttempts.createRunAttempt({
      id: "run-2",
      issueId: "i2",
      attemptNumber: 1,
      status: "running",
    });
    store.runAttempts.updateRunAttemptStatus("run-2", "failed", "mock_acp_failure");
    db.prepare(`UPDATE run_attempts SET finished_at = ? WHERE id = ?`).run(
      "2026-01-02T00:01:00.000Z",
      "run-2",
    );

    store.runAttempts.createRunAttempt({
      id: "run-3",
      issueId: "i1",
      attemptNumber: 2,
      status: "running",
    });

    expect(store.runAttempts.listRecentFinishedRunSnapshots("p1")).toEqual([
      {
        runAttemptId: "run-2",
        issueId: "i2",
        identifier: "P1-2",
        attemptNumber: 1,
        status: "failed",
        finishedAt: "2026-01-02T00:01:00.000Z",
        errorMessage: "mock_acp_failure",
      },
      {
        runAttemptId: "run-1",
        issueId: "i1",
        identifier: "P1-1",
        attemptNumber: 1,
        status: "succeeded",
        finishedAt: "2026-01-01T00:01:00.000Z",
        errorMessage: null,
      },
    ]);

    closeDatabase(db);
  });
});

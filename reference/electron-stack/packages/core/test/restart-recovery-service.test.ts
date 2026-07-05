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
import { TrackerService } from "@core/services/tracker-service";
import { RunLifecycleService } from "@core/services/run-lifecycle-service";
import { RestartRecoveryService } from "@core/services/restart-recovery-service";

const tempDirs: string[] = [];

function dbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-core-restart-recovery-test-"));
  tempDirs.push(dir);
  return path.join(dir, "recovery.sqlite");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("RestartRecoveryService", () => {
  test("converts stale running attempts into failed + retry queue entries", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project One", slug: "project-one" });

    const tracker = TrackerService.fromDatabase(db);
    tracker.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Recover me" });

    const store = createTrackerStore(db);
    const lifecycle = new RunLifecycleService(store.runAttempts, store.agentSessions);
    lifecycle.startRun({ runAttemptId: "i1:attempt:1", issueId: "i1", attemptNumber: 1 });
    lifecycle.attachSession({
      sessionId: "sess-1",
      runAttemptId: "i1:attempt:1",
      sessionRef: "11111111-1111-4111-8111-111111111111",
    });

    const recovery = new RestartRecoveryService(
      store.runAttempts,
      store.agentSessions,
      store.retryQueue,
    );
    const result = recovery.recoverStaleRuns({
      projectId: "p1",
      retryBaseDelayMs: 100,
      retryMaxDelayMs: 1000,
    });

    expect(result.recoveredAttempts).toBe(1);
    expect(result.recoveredSessions).toBe(1);

    const latest = store.runAttempts.getLatestRunAttempt("i1");
    expect(latest?.status).toBe("failed");
    expect(latest?.errorMessage).toBe("recovered_after_restart");

    const sessions = store.agentSessions.listSessionsByRunAttempt("i1:attempt:1");
    expect(sessions[0]?.status).toBe("failed");

    const retry = store.retryQueue.getRetry("i1");
    expect(retry?.attemptNumber).toBe(2);

    closeDatabase(db);
  });
});

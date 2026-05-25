import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  closeDatabase,
  migrateDown,
  migrateUp,
  openDatabase,
  seedProjectWithDefaultStates,
} from "@/index";

const tempDirs: string[] = [];

function createDbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-db-test-"));
  tempDirs.push(dir);
  return path.join(dir, "test.sqlite");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("db migrations", () => {
  test("applies up migrations idempotently", () => {
    const db = openDatabase(createDbPath());

    const firstRun = migrateUp(db);
    const secondRun = migrateUp(db);

    expect(firstRun).toEqual(["001_init", "002_retry_queue"]);
    expect(secondRun).toEqual([]);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toContain("issues");
    expect(tables.map((t) => t.name)).toContain("projects");
    expect(tables.map((t) => t.name)).toContain("workflow_states");

    closeDatabase(db);
  });

  test("enforces foreign keys on issue inserts", () => {
    const db = openDatabase(createDbPath());
    migrateUp(db);

    expect(() => {
      db.prepare(
        "INSERT INTO issues (id, project_id, workflow_state_id, identifier, title) VALUES (?, ?, ?, ?, ?)",
      ).run("issue-1", "missing-project", "missing-state", "ISSUE-1", "Broken insert");
    }).toThrowError();

    closeDatabase(db);
  });

  test("seeds default workflow states for a project", () => {
    const db = openDatabase(createDbPath());
    migrateUp(db);

    seedProjectWithDefaultStates(db, {
      id: "project-1",
      name: "Symphony",
      slug: "symphony",
    });

    const count = db
      .prepare("SELECT COUNT(*) as c FROM workflow_states WHERE project_id = ?")
      .get("project-1") as { c: number };

    const todoState = db
      .prepare("SELECT name, category FROM workflow_states WHERE id = ?")
      .get("project-1:todo") as { name: string; category: string };

    expect(count.c).toBe(4);
    expect(todoState).toEqual({ name: "Todo", category: "backlog" });

    closeDatabase(db);
  });

  test("can migrate down then back up", () => {
    const db = openDatabase(createDbPath());
    migrateUp(db);

    const removed = migrateDown(db, 1);
    expect(removed).toEqual(["002_retry_queue"]);

    const tablesAfterDown = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tablesAfterDown.map((t) => t.name)).toContain("issues");
    expect(tablesAfterDown.map((t) => t.name)).toContain("projects");
    expect(tablesAfterDown.map((t) => t.name)).not.toContain("retry_queue");

    const appliedAgain = migrateUp(db);
    expect(appliedAgain).toEqual(["002_retry_queue"]);

    closeDatabase(db);
  });
});

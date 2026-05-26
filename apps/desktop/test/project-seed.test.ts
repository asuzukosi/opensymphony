import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { closeDatabase, migrateUp, openDatabase } from "@symphony/db";
import {
  buildProjectSeedInput,
  ensureProjectSeededOnce,
} from "../src/runtime/project-seed";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function openTestDatabase() {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-project-seed-"));
  tempDirs.push(dir);
  const db = openDatabase(path.join(dir, "test.sqlite"));
  migrateUp(db);
  return db;
}

describe("buildProjectSeedInput", () => {
  test("derives slug from project id", () => {
    expect(buildProjectSeedInput("symphony-local")).toEqual({
      id: "symphony-local",
      name: "symphony-local",
      slug: "symphony-local",
    });
  });
});

describe("ensureProjectSeededOnce", () => {
  test("seeds configured project once per tracked project id", () => {
    const db = openTestDatabase();
    const seededProjectIds = new Set<string>();

    ensureProjectSeededOnce(db, "symphony-local", seededProjectIds);
    ensureProjectSeededOnce(db, "symphony-local", seededProjectIds);

    const count = db
      .prepare("SELECT COUNT(*) as c FROM workflow_states WHERE project_id = ?")
      .get("symphony-local") as { c: number };

    expect(seededProjectIds).toEqual(new Set(["symphony-local"]));
    expect(count.c).toBe(4);

    closeDatabase(db);
  });

  test("seeds again when configured project id changes", () => {
    const db = openTestDatabase();
    const seededProjectIds = new Set<string>();

    ensureProjectSeededOnce(db, "symphony-local", seededProjectIds);
    ensureProjectSeededOnce(db, "symphony-other", seededProjectIds);

    const localCount = db
      .prepare("SELECT COUNT(*) as c FROM workflow_states WHERE project_id = ?")
      .get("symphony-local") as { c: number };
    const otherCount = db
      .prepare("SELECT COUNT(*) as c FROM workflow_states WHERE project_id = ?")
      .get("symphony-other") as { c: number };

    expect(seededProjectIds).toEqual(new Set(["symphony-local", "symphony-other"]));
    expect(localCount.c).toBe(4);
    expect(otherCount.c).toBe(4);

    closeDatabase(db);
  });
});

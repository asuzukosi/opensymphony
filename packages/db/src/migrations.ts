import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { SqliteDatabase } from "@db/client";

export interface MigrationRecord {
  version: string;
  appliedAt: string;
}

function migrationsDir(): string {
  const thisFilePath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFilePath), "..", "migrations");
}

function readMigrationFiles(
  suffix: ".up.sql" | ".down.sql",
): Array<{ version: string; filePath: string }> {
  const dir = migrationsDir();
  return readdirSync(dir)
    .filter((file) => file.endsWith(suffix))
    .map((file) => ({ version: file.replace(suffix, ""), filePath: path.join(dir, file) }))
    .sort((a, b) => a.version.localeCompare(b.version));
}

export function ensureMigrationTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function listAppliedMigrations(db: SqliteDatabase): MigrationRecord[] {
  ensureMigrationTable(db);
  return db
    .prepare(
      "SELECT version AS version, applied_at AS appliedAt FROM schema_migrations ORDER BY version ASC",
    )
    .all() as MigrationRecord[];
}

export function migrateUp(db: SqliteDatabase): string[] {
  ensureMigrationTable(db);

  const applied = new Set(listAppliedMigrations(db).map((row) => row.version));
  const pending = readMigrationFiles(".up.sql").filter((entry) => !applied.has(entry.version));

  const applyStmt = db.prepare("INSERT INTO schema_migrations (version) VALUES (?)");
  const appliedNow: string[] = [];

  const tx = db.transaction(() => {
    for (const migration of pending) {
      const sql = readFileSync(migration.filePath, "utf8");
      db.exec(sql);
      applyStmt.run(migration.version);
      appliedNow.push(migration.version);
    }
  });

  tx();
  return appliedNow;
}

export function migrateDown(db: SqliteDatabase, steps = 1): string[] {
  ensureMigrationTable(db);
  const count = Math.max(0, Math.floor(steps));
  if (count === 0) return [];

  const applied = listAppliedMigrations(db).map((m) => m.version);
  const targets = applied.slice(-count).reverse();
  if (targets.length === 0) return [];

  const downMap = new Map(
    readMigrationFiles(".down.sql").map((entry) => [entry.version, entry.filePath]),
  );
  const deleteStmt = db.prepare("DELETE FROM schema_migrations WHERE version = ?");
  const removed: string[] = [];

  const tx = db.transaction(() => {
    for (const version of targets) {
      const downPath = downMap.get(version);
      if (!downPath) {
        throw new Error(`Missing down migration for version ${version}`);
      }

      deleteStmt.run(version);
      const sql = readFileSync(downPath, "utf8");
      db.exec(sql);
      removed.push(version);
    }
  });

  tx();
  return removed;
}

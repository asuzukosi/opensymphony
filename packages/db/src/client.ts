import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

export interface OpenDatabaseOptions {
  readonlyPath?: boolean;
}

export function openDatabase(path: string, options: OpenDatabaseOptions = {}): SqliteDatabase {
  const db = new Database(path, {
    readonly: options.readonlyPath ?? false,
    fileMustExist: options.readonlyPath ?? false,
  });

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function closeDatabase(db: SqliteDatabase): void {
  db.close();
}

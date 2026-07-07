use rusqlite::Connection;
use rusqlite::OptionalExtension;

use crate::db::error::{DbError, DbResult};

const MIGRATION_001: &str = include_str!("../../migrations/001_init.sql");
const MIGRATION_001_VERSION: &str = "001_init";

pub fn migrate(conn: &Connection) -> DbResult<()> {
    ensure_migration_table(conn)?;

    if is_applied(conn, MIGRATION_001_VERSION)? {
        return Ok(());
    }

    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(MIGRATION_001)?;
    tx.execute(
        "INSERT INTO schema_migrations (version) VALUES (?1)",
        [MIGRATION_001_VERSION],
    )?;
    tx.commit()?;
    Ok(())
}

fn ensure_migration_table(conn: &Connection) -> DbResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;
    Ok(())
}

fn is_applied(conn: &Connection, version: &str) -> DbResult<bool> {
    let applied = conn
        .query_row(
            "SELECT 1 FROM schema_migrations WHERE version = ?1",
            [version],
            |_| Ok(()),
        )
        .optional()
        .map_err(DbError::from)?
        .is_some();
    Ok(applied)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn open_test_connection() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory database");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("enable foreign keys");
        conn
    }

    #[test]
    fn migrate_applies_once() {
        let conn = open_test_connection();

        migrate(&conn).expect("first migrate");
        migrate(&conn).expect("second migrate");

        let version_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
                [MIGRATION_001_VERSION],
                |row| row.get(0),
            )
            .expect("count migration row");
        assert_eq!(version_count, 1);

        let table_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'",
                [],
                |row| row.get(0),
            )
            .expect("count tables");
        assert!(table_count >= 13);
    }

    #[test]
    fn migrate_rejects_invalid_board_column() {
        let conn = open_test_connection();
        migrate(&conn).expect("migrate");

        conn.execute(
            "INSERT INTO projects (id, name, slug) VALUES ('p1', 'Test', 'test')",
            [],
        )
        .expect("insert project");

        let err = conn
            .execute(
                "INSERT INTO issues (id, project_id, identifier, title, board_column)
                 VALUES ('i1', 'p1', 'SYM-1', 'Bad', 'invalid')",
                [],
            )
            .expect_err("invalid board column should fail");
        assert!(err.to_string().contains("CHECK constraint failed"));
    }
}

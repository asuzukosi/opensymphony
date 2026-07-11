use rusqlite::Connection;
use rusqlite::OptionalExtension;

use crate::db::error::{DbError, DbResult};

const MIGRATION: &str = include_str!("../../migrations/001_init.sql");
const MIGRATION_VERSION: &str = "001_init";

pub fn migrate(conn: &Connection) -> DbResult<()> {
    ensure_migration_table(conn)?;

    if is_applied(conn, MIGRATION_VERSION)? {
        return Ok(());
    }

    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(MIGRATION)?;
    tx.execute(
        "INSERT INTO schema_migrations (version) VALUES (?1)",
        [MIGRATION_VERSION],
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

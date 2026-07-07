pub mod error;
pub mod migrate;
pub mod repos;

#[cfg(test)]
pub mod test_helpers;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub use error::{DbError, DbResult};

pub const DB_FILE_NAME: &str = "opensymphony.sqlite";

pub struct Db(Mutex<Connection>);

impl Db {
    pub fn db_path(app: &AppHandle) -> DbResult<PathBuf> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|err| DbError::Internal(err.to_string()))?;
        Ok(dir.join(DB_FILE_NAME))
    }

    pub fn open(path: &Path) -> DbResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|err| DbError::Internal(err.to_string()))?;
        }

        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;",
        )?;
        migrate::migrate(&conn)?;

        Ok(Self(Mutex::new(conn)))
    }

    pub fn conn(&self) -> DbResult<MutexGuard<'_, Connection>> {
        self.0
            .lock()
            .map_err(|_| DbError::Internal("database lock poisoned".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_db_path() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("symphony-test-{nanos}.sqlite"))
    }

    #[test]
    fn open_creates_database_with_projects_table() {
        let path = temp_db_path();
        let db = Db::open(&path).expect("open database");
        let conn = db.conn().expect("lock connection");

        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'projects'",
                [],
                |row| row.get(0),
            )
            .expect("count projects table");

        assert_eq!(exists, 1);
        drop(conn);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn open_is_idempotent() {
        let path = temp_db_path();
        Db::open(&path).expect("first open");
        Db::open(&path).expect("second open");
        let _ = std::fs::remove_file(path);
    }
}

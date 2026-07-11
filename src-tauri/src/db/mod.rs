pub mod error;
pub mod migrate;
pub mod repos;
pub mod workflow;

#[cfg(test)]
pub mod fixtures;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub use error::{DbError, DbResult};

pub const DB_FILE_NAME: &str = "opensymphony.sqlite";

pub struct Db(Mutex<Connection>);

impl Db {
    pub fn app_data_dir(app: &AppHandle) -> DbResult<PathBuf> {
        app.path()
            .app_data_dir()
            .map_err(|err| DbError::Internal(err.to_string()))
    }

    pub fn db_path(app: &AppHandle) -> DbResult<PathBuf> {
        Ok(Self::app_data_dir(app)?.join(DB_FILE_NAME))
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


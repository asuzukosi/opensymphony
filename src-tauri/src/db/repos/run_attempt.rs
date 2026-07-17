use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::types::RunAttempt;

pub struct RunAttemptRepo<'a> {
    conn: &'a Connection,
}

impl<'a> RunAttemptRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create_with_attempt_number(
        &self,
        task_id: &str,
        attempt_number: i32,
    ) -> DbResult<RunAttempt> {
        let id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO run_attempts (id, task_id, attempt_number, status)
             VALUES (?1, ?2, ?3, 'running')",
            params![id, task_id, attempt_number],
        )?;
        self.get_internal(&id)?.ok_or_else(|| DbError::Internal("run attempt missing after create".into()))
    }

    pub fn finish(
        &self,
        id: &str,
        status: &str,
        error_message: Option<&str>,
    ) -> DbResult<RunAttempt> {
        let changed = self.conn.execute(
            "UPDATE run_attempts
             SET status = ?1, error_message = ?2, finished_at = datetime('now')
             WHERE id = ?3",
            params![status, error_message, id],
        )?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("run attempt {id}")));
        }
        self.get_internal(id)?.ok_or_else(|| DbError::NotFound(format!("run attempt {id}")))
    }

    pub fn list_by_task(&self, task_id: &str) -> DbResult<Vec<RunAttempt>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, task_id, attempt_number, status, started_at, finished_at, error_message
             FROM run_attempts
             WHERE task_id = ?1
             ORDER BY started_at DESC",
        )?;
        let mut rows = stmt.query([task_id])?;
        let mut attempts = Vec::new();
        while let Some(row) = rows.next()? {
            attempts.push(map_run_attempt(row)?);
        }
        Ok(attempts)
    }

    pub fn list_running(&self, project_id: &str) -> DbResult<Vec<RunAttempt>> {
        let mut stmt = self.conn.prepare(
            "SELECT ra.id, ra.task_id, ra.attempt_number, ra.status, ra.started_at,
                    ra.finished_at, ra.error_message
             FROM run_attempts ra
             JOIN tasks i ON i.id = ra.task_id
             WHERE i.project_id = ?1 AND ra.status = 'running'
             ORDER BY ra.started_at DESC",
        )?;
        let mut rows = stmt.query([project_id])?;
        let mut attempts = Vec::new();
        while let Some(row) = rows.next()? {
            attempts.push(map_run_attempt(row)?);
        }
        Ok(attempts)
    }

    pub fn get(&self, id: &str) -> DbResult<Option<RunAttempt>> {
        self.get_internal(id)
    }

    pub fn list_recent_finished(&self, project_id: &str, limit: i32) -> DbResult<Vec<RunAttempt>> {
        let mut stmt = self.conn.prepare(
            "SELECT ra.id, ra.task_id, ra.attempt_number, ra.status, ra.started_at,
                    ra.finished_at, ra.error_message
             FROM run_attempts ra
             JOIN tasks i ON i.id = ra.task_id
             WHERE i.project_id = ?1 AND ra.finished_at IS NOT NULL
             ORDER BY ra.finished_at DESC
             LIMIT ?2",
        )?;
        let mut rows = stmt.query(params![project_id, limit])?;
        let mut attempts = Vec::new();
        while let Some(row) = rows.next()? {
            attempts.push(map_run_attempt(row)?);
        }
        Ok(attempts)
    }

    fn get_internal(&self, id: &str) -> DbResult<Option<RunAttempt>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, task_id, attempt_number, status, started_at, finished_at, error_message
             FROM run_attempts WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_run_attempt(row)?));
        }
        Ok(None)
    }
}

fn map_run_attempt(row: &Row<'_>) -> rusqlite::Result<RunAttempt> {
    Ok(RunAttempt {
        id: row.get(0)?,
        task_id: row.get(1)?,
        attempt_number: row.get(2)?,
        status: row.get(3)?,
        started_at: row.get(4)?,
        finished_at: row.get(5)?,
        error_message: row.get(6)?,
    })
}

use rusqlite::{params, Connection, Row};

use crate::db::error::DbResult;
use crate::types::RetryQueueEntry;

pub struct RetryQueueRepo<'a> {
    conn: &'a Connection,
}

impl<'a> RetryQueueRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn upsert(
        &self,
        task_id: &str,
        attempt_number: i32,
        due_at: &str,
        error_message: Option<&str>,
    ) -> DbResult<()> {
        self.conn.execute(
            "INSERT INTO retry_queue (task_id, attempt_number, due_at, error_message)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(task_id) DO UPDATE SET
               attempt_number = excluded.attempt_number,
               due_at = excluded.due_at,
               error_message = excluded.error_message,
               updated_at = datetime('now')",
            params![task_id, attempt_number, due_at, error_message],
        )?;
        Ok(())
    }

    pub fn list_for_project(&self, project_id: &str) -> DbResult<Vec<RetryQueueEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT q.task_id, q.attempt_number, q.due_at, q.error_message
             FROM retry_queue q
             JOIN tasks i ON i.id = q.task_id
             WHERE i.project_id = ?1
             ORDER BY q.due_at ASC",
        )?;
        let mut rows = stmt.query([project_id])?;
        let mut entries = Vec::new();
        while let Some(row) = rows.next()? {
            entries.push(map_retry_queue_entry(row)?);
        }
        Ok(entries)
    }

    pub fn list_due_for_project(
        &self,
        project_id: &str,
        now_iso: &str,
    ) -> DbResult<Vec<RetryQueueEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT q.task_id, q.attempt_number, q.due_at, q.error_message
             FROM retry_queue q
             JOIN tasks i ON i.id = q.task_id
             WHERE i.project_id = ?1 AND q.due_at <= ?2
             ORDER BY q.due_at ASC",
        )?;
        let mut rows = stmt.query(params![project_id, now_iso])?;
        let mut entries = Vec::new();
        while let Some(row) = rows.next()? {
            entries.push(map_retry_queue_entry(row)?);
        }
        Ok(entries)
    }

    pub fn remove(&self, task_id: &str) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM retry_queue WHERE task_id = ?1", [task_id])?;
        Ok(())
    }

    pub fn take(&self, task_id: &str) -> DbResult<Option<RetryQueueEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT task_id, attempt_number, due_at, error_message
             FROM retry_queue
             WHERE task_id = ?1",
        )?;
        let mut rows = stmt.query([task_id])?;
        let Some(row) = rows.next()? else {
            return Ok(None);
        };
        let entry = map_retry_queue_entry(&row)?;
        self.remove(task_id)?;
        Ok(Some(entry))
    }
}

fn map_retry_queue_entry(row: &Row<'_>) -> rusqlite::Result<RetryQueueEntry> {
    Ok(RetryQueueEntry {
        task_id: row.get(0)?,
        attempt_number: row.get(1)?,
        due_at: row.get(2)?,
        error_message: row.get(3)?,
    })
}

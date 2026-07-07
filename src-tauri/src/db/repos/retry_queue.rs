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
        issue_id: &str,
        attempt_number: i32,
        due_at: &str,
        error_message: Option<&str>,
    ) -> DbResult<()> {
        self.conn.execute(
            "INSERT INTO retry_queue (issue_id, attempt_number, due_at, error_message)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(issue_id) DO UPDATE SET
               attempt_number = excluded.attempt_number,
               due_at = excluded.due_at,
               error_message = excluded.error_message,
               updated_at = datetime('now')",
            params![issue_id, attempt_number, due_at, error_message],
        )?;
        Ok(())
    }

    pub fn list_due(&self, now_iso: &str) -> DbResult<Vec<RetryQueueEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT issue_id, attempt_number, due_at, error_message
             FROM retry_queue
             WHERE due_at <= ?1
             ORDER BY due_at ASC",
        )?;
        let mut rows = stmt.query([now_iso])?;
        let mut entries = Vec::new();
        while let Some(row) = rows.next()? {
            entries.push(map_retry_queue_entry(row)?);
        }
        Ok(entries)
    }

    pub fn remove(&self, issue_id: &str) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM retry_queue WHERE issue_id = ?1", [issue_id])?;
        Ok(())
    }
}

fn map_retry_queue_entry(row: &Row<'_>) -> rusqlite::Result<RetryQueueEntry> {
    Ok(RetryQueueEntry {
        issue_id: row.get(0)?,
        attempt_number: row.get(1)?,
        due_at: row.get(2)?,
        error_message: row.get(3)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::{open_test_db, seed_minimal_project};

    #[test]
    fn upsert_list_due_and_remove() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed project");
        let repo = RetryQueueRepo::new(&conn);

        repo.upsert(
            &fixtures.in_progress_issue_id,
            2,
            "2026-01-01T00:00:00Z",
            Some("timeout"),
        )
        .expect("upsert retry");

        let due = repo
            .list_due("2026-01-01T12:00:00Z")
            .expect("list due retries");
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].issue_id, fixtures.in_progress_issue_id);

        repo.remove(&fixtures.in_progress_issue_id)
            .expect("remove retry");
        assert!(repo
            .list_due("2026-01-02T00:00:00Z")
            .expect("list due retries")
            .is_empty());
    }
}

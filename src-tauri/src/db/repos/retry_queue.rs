use rusqlite::{params, Connection, Row};

use crate::db::error::DbResult;

pub struct RetryQueueEntry {
    pub issue_id: String,
    pub attempt_number: i32,
    pub due_at: String,
    pub error_message: Option<String>,
}

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
    fn upsert_and_list_due() {
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
        repo.upsert(
            &fixtures.backlog_issue_id,
            1,
            "2026-01-02T00:00:00Z",
            None,
        )
        .expect("upsert future retry");

        let due = repo
            .list_due("2026-01-01T12:00:00Z")
            .expect("list due retries");
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].issue_id, fixtures.in_progress_issue_id);
        assert_eq!(due[0].attempt_number, 2);
        assert_eq!(due[0].error_message.as_deref(), Some("timeout"));
    }

    #[test]
    fn upsert_updates_existing_entry() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed project");
        let repo = RetryQueueRepo::new(&conn);

        repo.upsert(
            &fixtures.review_issue_id,
            1,
            "2026-01-01T00:00:00Z",
            Some("first"),
        )
        .expect("upsert first");
        repo.upsert(
            &fixtures.review_issue_id,
            3,
            "2026-01-03T00:00:00Z",
            Some("second"),
        )
        .expect("upsert second");

        let due = repo
            .list_due("2026-01-04T00:00:00Z")
            .expect("list due retries");
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].attempt_number, 3);
        assert_eq!(due[0].error_message.as_deref(), Some("second"));
    }

    #[test]
    fn remove_deletes_entry() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed project");
        let repo = RetryQueueRepo::new(&conn);

        repo.upsert(
            &fixtures.done_issue_id,
            1,
            "2026-01-01T00:00:00Z",
            None,
        )
        .expect("upsert retry");
        repo.remove(&fixtures.done_issue_id)
            .expect("remove retry");

        let due = repo
            .list_due("2026-01-02T00:00:00Z")
            .expect("list due retries");
        assert!(due.is_empty());
    }
}

use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};

pub struct RunAttempt {
    pub id: String,
    pub issue_id: String,
    pub attempt_number: i32,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error_message: Option<String>,
}

pub struct RunAttemptRepo<'a> {
    conn: &'a Connection,
}

impl<'a> RunAttemptRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create(&self, issue_id: &str) -> DbResult<RunAttempt> {
        let id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO run_attempts (id, issue_id, attempt_number, status)
             VALUES (
               ?1, ?2,
               (SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM run_attempts WHERE issue_id = ?2),
               'running'
             )",
            params![id, issue_id],
        )?;
        self.get(&id)?.ok_or_else(|| DbError::Internal("run attempt missing after create".into()))
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
        self.get(id)?.ok_or_else(|| DbError::NotFound(format!("run attempt {id}")))
    }

    pub fn list_by_issue(&self, issue_id: &str) -> DbResult<Vec<RunAttempt>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, issue_id, attempt_number, status, started_at, finished_at, error_message
             FROM run_attempts
             WHERE issue_id = ?1
             ORDER BY started_at DESC",
        )?;
        let mut rows = stmt.query([issue_id])?;
        let mut attempts = Vec::new();
        while let Some(row) = rows.next()? {
            attempts.push(map_run_attempt(row)?);
        }
        Ok(attempts)
    }

    pub fn list_running(&self, project_id: &str) -> DbResult<Vec<RunAttempt>> {
        let mut stmt = self.conn.prepare(
            "SELECT ra.id, ra.issue_id, ra.attempt_number, ra.status, ra.started_at,
                    ra.finished_at, ra.error_message
             FROM run_attempts ra
             JOIN issues i ON i.id = ra.issue_id
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

    pub fn list_recent_finished(&self, project_id: &str, limit: i32) -> DbResult<Vec<RunAttempt>> {
        let mut stmt = self.conn.prepare(
            "SELECT ra.id, ra.issue_id, ra.attempt_number, ra.status, ra.started_at,
                    ra.finished_at, ra.error_message
             FROM run_attempts ra
             JOIN issues i ON i.id = ra.issue_id
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

    fn get(&self, id: &str) -> DbResult<Option<RunAttempt>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, issue_id, attempt_number, status, started_at, finished_at, error_message
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
        issue_id: row.get(1)?,
        attempt_number: row.get(2)?,
        status: row.get(3)?,
        started_at: row.get(4)?,
        finished_at: row.get(5)?,
        error_message: row.get(6)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::{open_test_db, seed_issue_with_session, seed_minimal_project};

    #[test]
    fn create_increments_attempt_number() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed minimal project");
        let repo = RunAttemptRepo::new(&conn);

        let first = repo
            .create(&fixtures.in_progress_issue_id)
            .expect("create first attempt");
        let second = repo
            .create(&fixtures.in_progress_issue_id)
            .expect("create second attempt");

        assert_eq!(first.attempt_number, 1);
        assert_eq!(second.attempt_number, 2);
        assert_eq!(first.status, "running");
        assert!(first.finished_at.is_none());
    }

    #[test]
    fn finish_sets_status_and_finished_at() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_issue_with_session(&conn).expect("seed issue with session");
        let repo = RunAttemptRepo::new(&conn);

        let finished = repo
            .finish(
                &fixtures.run_attempt_id,
                "failed",
                Some("agent crashed"),
            )
            .expect("finish run attempt");

        assert_eq!(finished.status, "failed");
        assert_eq!(finished.error_message.as_deref(), Some("agent crashed"));
        assert!(finished.finished_at.is_some());
    }

    #[test]
    fn list_by_issue_orders_by_started_at_desc() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed minimal project");
        let repo = RunAttemptRepo::new(&conn);

        let first = repo
            .create(&fixtures.in_progress_issue_id)
            .expect("create first attempt");
        repo.finish(&first.id, "succeeded", None)
            .expect("finish first attempt");
        let second = repo
            .create(&fixtures.in_progress_issue_id)
            .expect("create second attempt");

        let attempts = repo
            .list_by_issue(&fixtures.in_progress_issue_id)
            .expect("list by issue");
        assert_eq!(attempts.len(), 2);
        assert_eq!(attempts[0].id, second.id);
        assert_eq!(attempts[1].id, first.id);
    }

    #[test]
    fn list_running_filters_by_project() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_issue_with_session(&conn).expect("seed issue with session");
        let repo = RunAttemptRepo::new(&conn);

        let running = repo
            .list_running(&fixtures.project_id)
            .expect("list running");
        assert_eq!(running.len(), 1);
        assert_eq!(running[0].id, fixtures.run_attempt_id);
    }

    #[test]
    fn list_recent_finished_respects_limit() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed minimal project");
        let repo = RunAttemptRepo::new(&conn);

        for _ in 0..3 {
            let attempt = repo
                .create(&fixtures.in_progress_issue_id)
                .expect("create attempt");
            repo.finish(&attempt.id, "succeeded", None)
                .expect("finish attempt");
        }

        let recent = repo
            .list_recent_finished(&fixtures.project_id, 2)
            .expect("list recent finished");
        assert_eq!(recent.len(), 2);
        assert!(
            recent[0].finished_at.as_ref().unwrap()
                >= recent[1].finished_at.as_ref().unwrap()
        );
    }
}

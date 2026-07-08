use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::types::AgentSession;

pub struct AgentSessionRepo<'a> {
    conn: &'a Connection,
}

impl<'a> AgentSessionRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create(&self, run_attempt_id: &str, runtime_kind: &str) -> DbResult<AgentSession> {
        let id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO agent_sessions (id, run_attempt_id, runtime_kind, status)
             VALUES (?1, ?2, ?3, 'running')",
            params![id, run_attempt_id, runtime_kind],
        )?;
        self.get(&id)?.ok_or_else(|| DbError::Internal("agent session missing after create".into()))
    }

    pub fn get(&self, id: &str) -> DbResult<Option<AgentSession>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, run_attempt_id, runtime_kind, session_ref, status, started_at, finished_at
             FROM agent_sessions WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_agent_session(row)?));
        }
        Ok(None)
    }

    pub fn list_by_run_attempt(&self, run_attempt_id: &str) -> DbResult<Vec<AgentSession>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, run_attempt_id, runtime_kind, session_ref, status, started_at, finished_at
             FROM agent_sessions
             WHERE run_attempt_id = ?1
             ORDER BY started_at ASC",
        )?;
        let mut rows = stmt.query([run_attempt_id])?;
        let mut sessions = Vec::new();
        while let Some(row) = rows.next()? {
            sessions.push(map_agent_session(row)?);
        }
        Ok(sessions)
    }

    pub fn set_session_ref(&self, id: &str, session_ref: &str) -> DbResult<AgentSession> {
        let changed = self.conn.execute(
            "UPDATE agent_sessions SET session_ref = ?1 WHERE id = ?2",
            params![session_ref, id],
        )?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("agent session {id}")));
        }
        self.get(id)?
            .ok_or_else(|| DbError::NotFound(format!("agent session {id}")))
    }

    pub fn finish(&self, id: &str, status: &str, finished_at: &str) -> DbResult<AgentSession> {
        let changed = self.conn.execute(
            "UPDATE agent_sessions
             SET status = ?1, finished_at = ?2
             WHERE id = ?3 AND status = 'running'",
            params![status, finished_at, id],
        )?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("agent session {id}")));
        }
        self.get(id)?
            .ok_or_else(|| DbError::NotFound(format!("agent session {id}")))
    }
}

fn map_agent_session(row: &Row<'_>) -> rusqlite::Result<AgentSession> {
    Ok(AgentSession {
        id: row.get(0)?,
        run_attempt_id: row.get(1)?,
        runtime_kind: row.get(2)?,
        session_ref: row.get(3)?,
        status: row.get(4)?,
        started_at: row.get(5)?,
        finished_at: row.get(6)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::{open_test_db, seed_issue_with_session};

    #[test]
    fn lifecycle_updates_session_ref_and_finish() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_issue_with_session(&conn).expect("seed issue with session");
        let repo = AgentSessionRepo::new(&conn);

        let session = repo
            .create(&fixtures.run_attempt_id, "acp")
            .expect("create agent session");

        let bound = repo
            .set_session_ref(&session.id, "acp-session-ref-1")
            .expect("set session ref");
        assert_eq!(bound.session_ref.as_deref(), Some("acp-session-ref-1"));

        let finished = repo
            .finish(&session.id, "succeeded", "2026-07-08T10:00:00Z")
            .expect("finish session");
        assert_eq!(finished.status, "succeeded");
        assert_eq!(finished.finished_at.as_deref(), Some("2026-07-08T10:00:00Z"));

        assert!(repo
            .finish(&session.id, "failed", "2026-07-08T10:01:00Z")
            .is_err());

        let sessions = repo
            .list_by_run_attempt(&fixtures.run_attempt_id)
            .expect("list by run attempt");
        assert_eq!(sessions.len(), 2);
    }
}

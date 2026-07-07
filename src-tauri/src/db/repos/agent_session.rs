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
    fn create_and_list_by_run_attempt() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_issue_with_session(&conn).expect("seed issue with session");
        let repo = AgentSessionRepo::new(&conn);

        let second = repo
            .create(&fixtures.run_attempt_id, "mock")
            .expect("create agent session");

        let sessions = repo
            .list_by_run_attempt(&fixtures.run_attempt_id)
            .expect("list by run attempt");
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[1].id, second.id);
    }
}

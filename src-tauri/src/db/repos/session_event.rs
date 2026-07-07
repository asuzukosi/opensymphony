use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};

pub const SESSION_EVENT_TAIL_CAP: i32 = 500;

pub struct SessionEvent {
    pub id: String,
    pub session_id: String,
    pub kind: String,
    pub payload_json: String,
    pub created_at: String,
}

pub struct SessionEventRepo<'a> {
    conn: &'a Connection,
}

impl<'a> SessionEventRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn append(
        &self,
        session_id: &str,
        kind: &str,
        payload_json: &str,
    ) -> DbResult<SessionEvent> {
        let id = Uuid::new_v4().to_string();

        self.conn.execute("BEGIN IMMEDIATE", [])?;
        let result = (|| -> DbResult<()> {
            self.conn.execute(
                "INSERT INTO session_events (id, session_id, kind, payload_json)
                 VALUES (?1, ?2, ?3, ?4)",
                params![id, session_id, kind, payload_json],
            )?;
            self.conn.execute(
                "DELETE FROM session_events
                 WHERE session_id = ?1
                   AND id NOT IN (
                     SELECT id FROM session_events
                     WHERE session_id = ?1
                     ORDER BY created_at DESC, rowid DESC
                     LIMIT ?2
                   )",
                params![session_id, SESSION_EVENT_TAIL_CAP],
            )?;
            Ok(())
        })();

        match result {
            Ok(()) => {
                self.conn.execute("COMMIT", [])?;
            }
            Err(err) => {
                let _ = self.conn.execute("ROLLBACK", []);
                return Err(err);
            }
        }

        self.get(&id)?
            .ok_or_else(|| DbError::Internal("session event missing after append".into()))
    }

    pub fn get(&self, id: &str) -> DbResult<Option<SessionEvent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, session_id, kind, payload_json, created_at
             FROM session_events WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_session_event(row)?));
        }
        Ok(None)
    }

    pub fn list_by_session(&self, session_id: &str) -> DbResult<Vec<SessionEvent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, session_id, kind, payload_json, created_at
             FROM session_events
             WHERE session_id = ?1
             ORDER BY created_at ASC, rowid ASC",
        )?;
        let mut rows = stmt.query([session_id])?;
        let mut events = Vec::new();
        while let Some(row) = rows.next()? {
            events.push(map_session_event(row)?);
        }
        Ok(events)
    }

    pub fn list_by_issue(&self, issue_id: &str) -> DbResult<Vec<SessionEvent>> {
        let mut stmt = self.conn.prepare(
            "SELECT se.id, se.session_id, se.kind, se.payload_json, se.created_at
             FROM session_events se
             JOIN agent_sessions s ON s.id = se.session_id
             JOIN run_attempts ra ON ra.id = s.run_attempt_id
             WHERE ra.issue_id = ?1
             ORDER BY se.created_at ASC, se.rowid ASC",
        )?;
        let mut rows = stmt.query([issue_id])?;
        let mut events = Vec::new();
        while let Some(row) = rows.next()? {
            events.push(map_session_event(row)?);
        }
        Ok(events)
    }
}

fn map_session_event(row: &Row<'_>) -> rusqlite::Result<SessionEvent> {
    Ok(SessionEvent {
        id: row.get(0)?,
        session_id: row.get(1)?,
        kind: row.get(2)?,
        payload_json: row.get(3)?,
        created_at: row.get(4)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::{open_test_db, seed_issue_with_session};

    #[test]
    fn append_and_list_by_session_returns_events_in_order() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_issue_with_session(&conn).expect("seed session");
        let repo = SessionEventRepo::new(&conn);

        let event = repo
            .append(&fixtures.session_id, "ToolCall", r#"{"name":"read"}"#)
            .expect("append event");

        assert_eq!(event.kind, "ToolCall");
        assert_eq!(event.session_id, fixtures.session_id);

        let events = repo
            .list_by_session(&fixtures.session_id)
            .expect("list by session");
        assert_eq!(events.len(), 4);
        assert_eq!(events[0].kind, "Prompt");
        assert_eq!(events[3].kind, "ToolCall");
    }

    #[test]
    fn list_by_issue_joins_through_run_attempt() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_issue_with_session(&conn).expect("seed session");
        let repo = SessionEventRepo::new(&conn);

        let events = repo
            .list_by_issue(&fixtures.issue_id)
            .expect("list by issue");

        assert_eq!(events.len(), 3);
        assert!(events.iter().all(|event| event.session_id == fixtures.session_id));
    }

    #[test]
    fn append_trims_tail_beyond_cap() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_issue_with_session(&conn).expect("seed session");
        let repo = SessionEventRepo::new(&conn);

        conn.execute(
            "DELETE FROM session_events WHERE session_id = ?1",
            [&fixtures.session_id],
        )
        .expect("clear seed events");

        for i in 0..=SESSION_EVENT_TAIL_CAP {
            repo.append(
                &fixtures.session_id,
                "StreamChunk",
                &format!(r#"{{"index":{i}}}"#),
            )
            .expect("append chunk");
        }

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM session_events WHERE session_id = ?1",
                [&fixtures.session_id],
                |row| row.get(0),
            )
            .expect("count events");
        assert_eq!(count, SESSION_EVENT_TAIL_CAP as i64);

        let events = repo
            .list_by_session(&fixtures.session_id)
            .expect("list by session");
        assert_eq!(events.len(), SESSION_EVENT_TAIL_CAP as usize);
        assert!(events[0].payload_json.contains("\"index\":1"));
        assert!(events
            .last()
            .unwrap()
            .payload_json
            .contains(&format!("\"index\":{SESSION_EVENT_TAIL_CAP}")));
    }
}

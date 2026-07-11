use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use std::str::FromStr;

use crate::db::error::{DbError, DbResult};
use crate::types::{SessionEvent, SessionEventKind};

pub const SESSION_EVENT_TAIL_CAP: i32 = 500;

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
    let kind: String = row.get(2)?;
    let payload_json: String = row.get(3)?;
    Ok(SessionEvent {
        id: row.get(0)?,
        session_id: Some(row.get(1)?),
        kind: SessionEventKind::from_str(&kind).map_err(|()| {
            rusqlite::Error::InvalidColumnType(2, kind, rusqlite::types::Type::Text)
        })?,
        payload: serde_json::from_str(&payload_json).unwrap_or(serde_json::Value::Null),
        created_at: row.get(4)?,
    })
}


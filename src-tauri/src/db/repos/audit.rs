use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::DbResult;
use crate::types::AuditEvent;

pub struct AuditRepo<'a> {
    conn: &'a Connection,
}

impl<'a> AuditRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn append(
        &self,
        project_id: &str,
        action: &str,
        issue_id: Option<&str>,
    ) -> DbResult<AuditEvent> {
        let id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO audit_events (id, project_id, issue_id, action)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, project_id, issue_id, action],
        )?;
        self.get(&id)?
            .ok_or_else(|| crate::db::error::DbError::Internal("audit event missing after append".into()))
    }

    pub fn get(&self, id: &str) -> DbResult<Option<AuditEvent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, issue_id, action, created_at
             FROM audit_events WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_audit_event(row)?));
        }
        Ok(None)
    }

    pub fn list_recent(&self, project_id: &str, limit: i32) -> DbResult<Vec<AuditEvent>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, issue_id, action, created_at
             FROM audit_events
             WHERE project_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )?;
        let mut rows = stmt.query(params![project_id, limit])?;
        let mut events = Vec::new();
        while let Some(row) = rows.next()? {
            events.push(map_audit_event(row)?);
        }
        Ok(events)
    }
}

fn map_audit_event(row: &Row<'_>) -> rusqlite::Result<AuditEvent> {
    Ok(AuditEvent {
        id: row.get(0)?,
        project_id: row.get(1)?,
        issue_id: row.get(2)?,
        action: row.get(3)?,
        created_at: row.get(4)?,
    })
}


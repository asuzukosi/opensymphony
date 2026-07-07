use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};

pub struct PendingPermission {
    pub id: String,
    pub session_id: String,
    pub issue_id: String,
    pub summary: String,
    pub payload_json: String,
    pub created_at: String,
}

pub struct PendingPermissionRepo<'a> {
    conn: &'a Connection,
}

impl<'a> PendingPermissionRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn insert(
        &self,
        session_id: &str,
        issue_id: &str,
        summary: &str,
        payload_json: &str,
    ) -> DbResult<PendingPermission> {
        let id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO pending_permissions (id, session_id, issue_id, summary, payload_json)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, session_id, issue_id, summary, payload_json],
        )?;
        self.get(&id)?
            .ok_or_else(|| DbError::Internal("pending permission missing after insert".into()))
    }

    pub fn get(&self, id: &str) -> DbResult<Option<PendingPermission>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, session_id, issue_id, summary, payload_json, created_at
             FROM pending_permissions WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_pending_permission(row)?));
        }
        Ok(None)
    }

    pub fn list_by_issue(&self, issue_id: &str) -> DbResult<Vec<PendingPermission>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, session_id, issue_id, summary, payload_json, created_at
             FROM pending_permissions
             WHERE issue_id = ?1
             ORDER BY created_at ASC",
        )?;
        let mut rows = stmt.query([issue_id])?;
        let mut permissions = Vec::new();
        while let Some(row) = rows.next()? {
            permissions.push(map_pending_permission(row)?);
        }
        Ok(permissions)
    }

    pub fn resolve(&self, id: &str) -> DbResult<()> {
        let changed = self
            .conn
            .execute("DELETE FROM pending_permissions WHERE id = ?1", [id])?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("pending permission {id}")));
        }
        Ok(())
    }
}

fn map_pending_permission(row: &Row<'_>) -> rusqlite::Result<PendingPermission> {
    Ok(PendingPermission {
        id: row.get(0)?,
        session_id: row.get(1)?,
        issue_id: row.get(2)?,
        summary: row.get(3)?,
        payload_json: row.get(4)?,
        created_at: row.get(5)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::{open_test_db, seed_issue_with_session};

    #[test]
    fn insert_and_list_by_issue() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_issue_with_session(&conn).expect("seed session");
        let repo = PendingPermissionRepo::new(&conn);

        let first = repo
            .insert(
                &fixtures.session_id,
                &fixtures.issue_id,
                "approve file write",
                r#"{"path":"/tmp/out"}"#,
            )
            .expect("insert permission");
        let second = repo
            .insert(
                &fixtures.session_id,
                &fixtures.issue_id,
                "approve network",
                r#"{"host":"example.com"}"#,
            )
            .expect("insert second permission");

        let listed = repo
            .list_by_issue(&fixtures.issue_id)
            .expect("list by issue");
        assert_eq!(listed.len(), 2);
        assert_eq!(listed[0].id, first.id);
        assert_eq!(listed[1].id, second.id);
    }

    #[test]
    fn resolve_deletes_permission() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_issue_with_session(&conn).expect("seed session");
        let repo = PendingPermissionRepo::new(&conn);

        let permission = repo
            .insert(
                &fixtures.session_id,
                &fixtures.issue_id,
                "approve shell",
                r#"{"cmd":"ls"}"#,
            )
            .expect("insert permission");

        repo.resolve(&permission.id).expect("resolve permission");
        assert!(repo.get(&permission.id).expect("get").is_none());
    }

    #[test]
    fn resolve_missing_returns_not_found() {
        let conn = open_test_db().expect("open test db");
        let repo = PendingPermissionRepo::new(&conn);

        let err = repo
            .resolve("missing-permission")
            .expect_err("resolve missing");
        assert!(matches!(err, DbError::NotFound(_)));
    }
}

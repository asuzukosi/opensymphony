use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::types::IssueComment;

pub struct CommentRepo<'a> {
    conn: &'a Connection,
}

impl<'a> CommentRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn append(
        &self,
        issue_id: &str,
        body: &str,
        author_id: Option<&str>,
    ) -> DbResult<IssueComment> {
        let id = Uuid::new_v4().to_string();

        self.conn.execute(
            "INSERT INTO issue_comments (id, issue_id, body, author_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, issue_id, body, author_id],
        )?;

        self.get(&id)?.ok_or_else(|| DbError::Internal("comment missing after append".into()))
    }

    pub fn list_by_issue(&self, issue_id: &str) -> DbResult<Vec<IssueComment>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, issue_id, body, author_id, created_at
             FROM issue_comments
             WHERE issue_id = ?1
             ORDER BY created_at ASC",
        )?;

        let mut rows = stmt.query([issue_id])?;
        let mut comments = Vec::new();
        while let Some(row) = rows.next()? {
            comments.push(map_comment(row)?);
        }
        Ok(comments)
    }

    fn get(&self, id: &str) -> DbResult<Option<IssueComment>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, issue_id, body, author_id, created_at
             FROM issue_comments WHERE id = ?1",
        )?;

        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_comment(row)?));
        }
        Ok(None)
    }
}

fn map_comment(row: &Row<'_>) -> rusqlite::Result<IssueComment> {
    Ok(IssueComment {
        id: row.get(0)?,
        issue_id: row.get(1)?,
        body: row.get(2)?,
        author_id: row.get(3)?,
        created_at: row.get(4)?,
    })
}


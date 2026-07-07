use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};

pub struct Comment {
    pub id: String,
    pub issue_id: String,
    pub body: String,
    pub author_id: Option<String>,
    pub created_at: String,
}

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
    ) -> DbResult<Comment> {
        let id = Uuid::new_v4().to_string();

        self.conn.execute(
            "INSERT INTO issue_comments (id, issue_id, body, author_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, issue_id, body, author_id],
        )?;

        self.get(&id)?.ok_or_else(|| DbError::Internal("comment missing after append".into()))
    }

    pub fn list_by_issue(&self, issue_id: &str) -> DbResult<Vec<Comment>> {
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

    fn get(&self, id: &str) -> DbResult<Option<Comment>> {
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

fn map_comment(row: &Row<'_>) -> rusqlite::Result<Comment> {
    Ok(Comment {
        id: row.get(0)?,
        issue_id: row.get(1)?,
        body: row.get(2)?,
        author_id: row.get(3)?,
        created_at: row.get(4)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::{open_test_db, seed_minimal_project};

    #[test]
    fn append_and_list_by_issue() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed minimal project");
        let repo = CommentRepo::new(&conn);

        let first = repo
            .append(
                &fixtures.backlog_issue_id,
                "first comment",
                Some("author-1"),
            )
            .expect("append first comment");
        let second = repo
            .append(&fixtures.backlog_issue_id, "second comment", None)
            .expect("append second comment");

        assert_eq!(first.issue_id, fixtures.backlog_issue_id);
        assert_eq!(first.body, "first comment");
        assert_eq!(first.author_id.as_deref(), Some("author-1"));
        assert_eq!(second.author_id, None);

        let comments = repo
            .list_by_issue(&fixtures.backlog_issue_id)
            .expect("list comments");

        assert_eq!(comments.len(), 2);
        assert_eq!(comments[0].id, first.id);
        assert_eq!(comments[0].body, "first comment");
        assert_eq!(comments[1].id, second.id);
        assert_eq!(comments[1].body, "second comment");
    }
}

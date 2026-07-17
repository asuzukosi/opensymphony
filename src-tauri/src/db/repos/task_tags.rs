use rusqlite::{params, Connection};

use crate::db::error::DbResult;

pub struct TaskTagsRepo<'a> {
    conn: &'a Connection,
}

impl<'a> TaskTagsRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list(&self, task_id: &str) -> DbResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT tag FROM task_tags WHERE task_id = ?1 ORDER BY tag ASC",
        )?;
        let mut rows = stmt.query([task_id])?;
        let mut tags = Vec::new();
        while let Some(row) = rows.next()? {
            tags.push(row.get(0)?);
        }
        Ok(tags)
    }

    pub fn replace(&self, task_id: &str, tags: &[String]) -> DbResult<()> {
        let normalized = normalize_tags(tags);
        let tx = self.conn.unchecked_transaction()?;
        tx.execute("DELETE FROM task_tags WHERE task_id = ?1", [task_id])?;
        for tag in normalized {
            tx.execute(
                "INSERT INTO task_tags (task_id, tag) VALUES (?1, ?2)",
                params![task_id, tag],
            )?;
        }
        tx.commit()?;
        Ok(())
    }
}

fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut normalized = Vec::new();
    for tag in tags {
        let trimmed = tag.trim();
        if trimmed.is_empty() {
            continue;
        }
        let key = trimmed.to_ascii_lowercase();
        if seen.insert(key) {
            normalized.push(trimmed.to_string());
        }
    }
    normalized.sort();
    normalized
}

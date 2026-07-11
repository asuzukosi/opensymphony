use rusqlite::{params, Connection};

use crate::db::error::DbResult;

pub struct IssueTagsRepo<'a> {
    conn: &'a Connection,
}

impl<'a> IssueTagsRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list(&self, issue_id: &str) -> DbResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT tag FROM issue_tags WHERE issue_id = ?1 ORDER BY tag ASC",
        )?;
        let mut rows = stmt.query([issue_id])?;
        let mut tags = Vec::new();
        while let Some(row) = rows.next()? {
            tags.push(row.get(0)?);
        }
        Ok(tags)
    }

    pub fn replace(&self, issue_id: &str, tags: &[String]) -> DbResult<()> {
        let normalized = normalize_tags(tags);
        let tx = self.conn.unchecked_transaction()?;
        tx.execute("DELETE FROM issue_tags WHERE issue_id = ?1", [issue_id])?;
        for tag in normalized {
            tx.execute(
                "INSERT INTO issue_tags (issue_id, tag) VALUES (?1, ?2)",
                params![issue_id, tag],
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::fixtures::{open_test_db, seed_minimal_project};

    #[test]
    fn replace_tags_dedupes_and_sorts() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        let repo = IssueTagsRepo::new(&conn);

        repo.replace(
            &fixtures.backlog_issue_id,
            &[
                "Wireframe".into(),
                "wireframe".into(),
                " Task ".into(),
            ],
        )
        .expect("replace");

        let tags = repo.list(&fixtures.backlog_issue_id).expect("list");
        assert_eq!(tags, vec!["Task", "Wireframe"]);
    }
}

use std::str::FromStr;

use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::types::BoardColumnId;

pub struct Issue {
    pub id: String,
    pub project_id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub board_column: BoardColumnId,
    pub created_at: String,
    pub updated_at: String,
}

pub struct IssueCard {
    pub issue_id: String,
    pub identifier: String,
    pub title: String,
    pub priority: Option<i32>,
}

#[derive(Default)]
pub struct IssuePatch {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<i32>,
}

pub struct IssueRepo<'a> {
    conn: &'a Connection,
}

impl<'a> IssueRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create(
        &self,
        project_id: &str,
        title: &str,
        description: Option<&str>,
    ) -> DbResult<Issue> {
        let id = Uuid::new_v4().to_string();
        let identifier = self.next_identifier(project_id)?;

        self.conn.execute(
            "INSERT INTO issues (id, project_id, identifier, title, description)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, project_id, identifier, title, description],
        )?;

        self.get(&id)?.ok_or_else(|| DbError::Internal("issue missing after create".into()))
    }

    pub fn get(&self, id: &str) -> DbResult<Option<Issue>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, identifier, title, description, priority,
                    board_column, created_at, updated_at
             FROM issues WHERE id = ?1",
        )?;

        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_issue(row)?));
        }
        Ok(None)
    }

    pub fn get_card(&self, id: &str) -> DbResult<Option<IssueCard>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, identifier, title, priority FROM issues WHERE id = ?1",
        )?;

        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_issue_card(row)?));
        }
        Ok(None)
    }

    pub fn list_by_column(
        &self,
        project_id: &str,
        column: BoardColumnId,
    ) -> DbResult<Vec<IssueCard>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, identifier, title, priority
             FROM issues
             WHERE project_id = ?1 AND board_column = ?2
             ORDER BY priority IS NULL, priority ASC, updated_at ASC",
        )?;

        let mut rows = stmt.query(params![project_id, column.as_str()])?;
        let mut cards = Vec::new();
        while let Some(row) = rows.next()? {
            cards.push(map_issue_card(row)?);
        }
        Ok(cards)
    }

    pub fn transition_column(&self, id: &str, column: BoardColumnId) -> DbResult<Issue> {
        let changed = self.conn.execute(
            "UPDATE issues SET board_column = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![column.as_str(), id],
        )?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("issue {id}")));
        }

        self.get(id)?.ok_or_else(|| DbError::NotFound(format!("issue {id}")))
    }

    pub fn update(&self, id: &str, patch: &IssuePatch) -> DbResult<Issue> {
        let mut sets = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(title) = &patch.title {
            sets.push("title = ?");
            values.push(Box::new(title.clone()));
        }
        if let Some(description) = &patch.description {
            sets.push("description = ?");
            values.push(Box::new(description.clone()));
        }
        if let Some(priority) = patch.priority {
            sets.push("priority = ?");
            values.push(Box::new(priority));
        }

        if sets.is_empty() {
            return self
                .get(id)?
                .ok_or_else(|| DbError::NotFound(format!("issue {id}")));
        }

        sets.push("updated_at = datetime('now')");
        values.push(Box::new(id.to_string()));

        let sql = format!("UPDATE issues SET {} WHERE id = ?", sets.join(", "));
        let params: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|value| value.as_ref()).collect();

        let changed = self.conn.execute(&sql, params.as_slice())?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("issue {id}")));
        }

        self.get(id)?.ok_or_else(|| DbError::NotFound(format!("issue {id}")))
    }

    pub fn list_candidates(&self, project_id: &str) -> DbResult<Vec<IssueCard>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, identifier, title, priority
             FROM issues
             WHERE project_id = ?1 AND board_column IN ('backlog', 'inProgress')
             ORDER BY priority IS NULL, priority ASC, updated_at ASC",
        )?;

        let mut rows = stmt.query([project_id])?;
        let mut cards = Vec::new();
        while let Some(row) = rows.next()? {
            cards.push(map_issue_card(row)?);
        }
        Ok(cards)
    }

    fn next_identifier(&self, project_id: &str) -> DbResult<String> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM issues WHERE project_id = ?1",
            [project_id],
            |row| row.get(0),
        )?;
        Ok(format!("SYM-{}", count + 1))
    }
}

fn map_issue(row: &Row<'_>) -> rusqlite::Result<Issue> {
    let board_column: String = row.get(6)?;
    Ok(Issue {
        id: row.get(0)?,
        project_id: row.get(1)?,
        identifier: row.get(2)?,
        title: row.get(3)?,
        description: row.get(4)?,
        priority: row.get(5)?,
        board_column: parse_board_column(&board_column)
            .map_err(|err| rusqlite::Error::InvalidColumnType(6, err.to_string(), rusqlite::types::Type::Text))?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn map_issue_card(row: &Row<'_>) -> rusqlite::Result<IssueCard> {
    Ok(IssueCard {
        issue_id: row.get(0)?,
        identifier: row.get(1)?,
        title: row.get(2)?,
        priority: row.get(3)?,
    })
}

fn parse_board_column(value: &str) -> DbResult<BoardColumnId> {
    BoardColumnId::from_str(value)
        .map_err(|()| DbError::Internal(format!("unknown board column: {value}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::{open_test_db, seed_minimal_project};

    #[test]
    fn create_generates_auto_identifier() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed minimal project");
        let repo = IssueRepo::new(&conn);

        let issue = repo
            .create(&fixtures.project_id, "New issue", Some("details"))
            .expect("create issue");

        assert_eq!(issue.identifier, "SYM-5");
        assert_eq!(issue.title, "New issue");
        assert_eq!(issue.description.as_deref(), Some("details"));
        assert_eq!(issue.board_column, BoardColumnId::Backlog);
    }

    #[test]
    fn list_by_column_returns_ordered_cards() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed minimal project");
        let repo = IssueRepo::new(&conn);

        conn.execute(
            "UPDATE issues SET priority = 2, updated_at = '2026-01-01T00:00:00Z' WHERE id = ?1",
            [&fixtures.backlog_issue_id],
        )
        .expect("set backlog priority");
        conn.execute(
            "INSERT INTO issues (id, project_id, identifier, title, board_column, priority, updated_at)
             VALUES ('extra-backlog', ?1, 'SYM-99', 'No priority', 'backlog', NULL, '2026-01-02T00:00:00Z')",
            [&fixtures.project_id],
        )
        .expect("insert extra backlog issue");
        conn.execute(
            "INSERT INTO issues (id, project_id, identifier, title, board_column, priority, updated_at)
             VALUES ('prio-backlog', ?1, 'SYM-100', 'High priority', 'backlog', 1, '2026-01-03T00:00:00Z')",
            [&fixtures.project_id],
        )
        .expect("insert priority backlog issue");

        let cards = repo
            .list_by_column(&fixtures.project_id, BoardColumnId::Backlog)
            .expect("list backlog");

        assert_eq!(cards.len(), 3);
        assert_eq!(cards[0].identifier, "SYM-100");
        assert_eq!(cards[0].priority, Some(1));
        assert_eq!(cards[1].identifier, "SYM-1");
        assert_eq!(cards[1].priority, Some(2));
        assert_eq!(cards[2].identifier, "SYM-99");
        assert_eq!(cards[2].priority, None);
    }

    #[test]
    fn transition_column_moves_issue() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed minimal project");
        let repo = IssueRepo::new(&conn);

        let updated = repo
            .transition_column(&fixtures.backlog_issue_id, BoardColumnId::Review)
            .expect("transition issue");

        assert_eq!(updated.board_column, BoardColumnId::Review);
        assert_eq!(
            repo.list_by_column(&fixtures.project_id, BoardColumnId::Backlog)
                .expect("list backlog")
                .len(),
            0
        );
    }

    #[test]
    fn update_applies_patch_fields() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed minimal project");
        let repo = IssueRepo::new(&conn);

        let updated = repo
            .update(
                &fixtures.backlog_issue_id,
                &IssuePatch {
                    title: Some("Renamed issue".into()),
                    description: Some("updated description".into()),
                    priority: Some(3),
                },
            )
            .expect("update issue");

        assert_eq!(updated.title, "Renamed issue");
        assert_eq!(updated.description.as_deref(), Some("updated description"));
        assert_eq!(updated.priority, Some(3));
    }

    #[test]
    fn list_candidates_returns_backlog_and_in_progress() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed minimal project");
        let repo = IssueRepo::new(&conn);

        let cards = repo
            .list_candidates(&fixtures.project_id)
            .expect("list candidates");

        assert_eq!(cards.len(), 2);
        let identifiers: Vec<&str> = cards.iter().map(|card| card.identifier.as_str()).collect();
        assert!(identifiers.contains(&"SYM-1"));
        assert!(identifiers.contains(&"SYM-2"));
    }
}

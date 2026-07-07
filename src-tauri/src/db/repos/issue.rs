use std::str::FromStr;

use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::types::{BoardColumnId, Issue, IssuePatch, ProjectBoardIssue};

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

    pub fn get_card(&self, id: &str) -> DbResult<Option<ProjectBoardIssue>> {
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
    ) -> DbResult<Vec<ProjectBoardIssue>> {
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

    pub fn list_candidates(&self, project_id: &str) -> DbResult<Vec<ProjectBoardIssue>> {
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

fn map_issue_card(row: &Row<'_>) -> rusqlite::Result<ProjectBoardIssue> {
    Ok(ProjectBoardIssue {
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
    fn create_transition_and_list_by_column() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed minimal project");
        let repo = IssueRepo::new(&conn);

        let issue = repo
            .create(&fixtures.project_id, "New issue", None)
            .expect("create issue");
        assert_eq!(issue.identifier, "SYM-5");

        let updated = repo
            .transition_column(&fixtures.backlog_issue_id, BoardColumnId::Review)
            .expect("transition issue");
        assert_eq!(updated.board_column, BoardColumnId::Review);

        let cards = repo
            .list_by_column(&fixtures.project_id, BoardColumnId::Review)
            .expect("list review");
        assert_eq!(cards.len(), 2);
    }
}

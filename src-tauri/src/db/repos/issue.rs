use std::str::FromStr;

use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::db::repos::issue_files::IssueFilesRepo;
use crate::db::repos::issue_tags::IssueTagsRepo;
use crate::db::repos::platforms::PlatformsRepo;
use crate::types::{BoardColumnId, Issue, IssueHeader, IssuePatch, Platform, ProjectBoardIssue};

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
        executor: Option<&str>,
        priority: Option<i32>,
        tags: &[String],
    ) -> DbResult<Issue> {
        validate_executor(&PlatformsRepo::new(self.conn), project_id, executor)?;

        let id = Uuid::new_v4().to_string();
        let identifier = self.next_identifier(project_id)?;

        self.conn.execute(
            "INSERT INTO issues (id, project_id, identifier, title, description, priority, executor)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                project_id,
                identifier,
                title,
                description,
                priority,
                executor
            ],
        )?;

        IssueTagsRepo::new(self.conn).replace(&id, tags)?;

        self.get(&id)?.ok_or_else(|| DbError::Internal("issue missing after create".into()))
    }

    pub fn build_header(&self, issue: Issue) -> DbResult<IssueHeader> {
        let mut header = IssueHeader::from(issue);
        header.tags = IssueTagsRepo::new(self.conn).list(&header.issue_id)?;
        header.files = IssueFilesRepo::new(self.conn).list(&header.issue_id)?;
        Ok(header)
    }

    pub fn get_header(&self, id: &str) -> DbResult<Option<IssueHeader>> {
        let Some(issue) = self.get(id)? else {
            return Ok(None);
        };
        Ok(Some(self.build_header(issue)?))
    }

    pub fn get(&self, id: &str) -> DbResult<Option<Issue>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, identifier, title, description, priority,
                    board_column, executor, created_at, updated_at
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

    pub fn set_executor(&self, id: &str, executor: Option<&str>) -> DbResult<Issue> {
        let issue = self
            .get(id)?
            .ok_or_else(|| DbError::NotFound(format!("issue {id}")))?;
        validate_executor(
            &PlatformsRepo::new(self.conn),
            &issue.project_id,
            executor,
        )?;

        let changed = self.conn.execute(
            "UPDATE issues SET executor = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![executor, id],
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
            "SELECT i.id, i.identifier, i.title, i.priority
             FROM issues i
             WHERE i.project_id = ?1
               AND i.board_column = ?2
               AND NOT EXISTS (
                 SELECT 1
                 FROM run_attempts ra
                 WHERE ra.issue_id = i.id AND ra.status = 'succeeded'
               )
             ORDER BY i.priority IS NULL, i.priority ASC, i.updated_at ASC",
        )?;

        let mut rows = stmt.query(params![project_id, BoardColumnId::Backlog.as_str()])?;
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

fn validate_executor(
    platforms: &PlatformsRepo<'_>,
    project_id: &str,
    executor: Option<&str>,
) -> DbResult<()> {
    let Some(platform_id) = executor else {
        return Ok(());
    };

    Platform::from_str(platform_id).map_err(DbError::Internal)?;
    if platforms.is_connected(project_id, platform_id)? {
        Ok(())
    } else {
        Err(DbError::Internal(format!(
            "executor {platform_id} is not assigned to project"
        )))
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
        executor: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
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
    use crate::db::fixtures::{open_test_db, seed_minimal_project};

    #[test]
    fn create_issue_with_valid_executor() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");

        let issue = IssueRepo::new(&conn)
            .create(&fixtures.project_id, "Executor issue", None, Some("hermes"), Some(2), &[])
            .expect("create");

        assert_eq!(issue.executor.as_deref(), Some("hermes"));
    }

    #[test]
    fn create_issue_rejects_unassigned_executor() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");

        let err = IssueRepo::new(&conn)
            .create(&fixtures.project_id, "Bad executor", None, Some("codex"), None, &[])
            .expect_err("reject");

        assert!(err.to_string().contains("not assigned"));
    }

    #[test]
    fn set_executor_updates_and_clears() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        let repo = IssueRepo::new(&conn);

        let issue = repo
            .create(&fixtures.project_id, "Mutable executor", None, None, None, &[])
            .expect("create");

        let updated = repo
            .set_executor(&issue.id, Some("hermes"))
            .expect("set executor");
        assert_eq!(updated.executor.as_deref(), Some("hermes"));

        let cleared = repo.set_executor(&issue.id, None).expect("clear executor");
        assert!(cleared.executor.is_none());
    }

    #[test]
    fn set_executor_rejects_unknown_platform() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        let repo = IssueRepo::new(&conn);

        let issue = repo
            .create(&fixtures.project_id, "No executor", None, None, None, &[])
            .expect("create");

        let err = repo
            .set_executor(&issue.id, Some("not-a-platform"))
            .expect_err("reject");

        assert!(err.to_string().contains("unknown platform"));
    }
}

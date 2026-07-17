use std::str::FromStr;

use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::db::repos::task_files::TaskFilesRepo;
use crate::db::repos::task_tags::TaskTagsRepo;
use crate::db::repos::platforms::PlatformsRepo;
use crate::types::{
    BoardColumnId, Task, TaskHeader, TaskPatch, Platform, ProjectBoardTask,
    ProjectTaskListItem,
};

const TASK_CARD_SELECT: &str = "id, identifier, title, description, priority, executor";
const TASK_CARD_SELECT_ALIASED: &str =
    "i.id, i.identifier, i.title, i.description, i.priority, i.executor";
const TASK_CARD_ORDER_BY: &str = "ORDER BY priority IS NULL, priority ASC, updated_at ASC";
const TASK_CARD_ORDER_BY_ALIASED: &str =
    "ORDER BY i.priority IS NULL, i.priority ASC, i.updated_at ASC";
const ISSUE_LIST_SELECT: &str = "id, identifier, title, description, priority, board_column, executor";

pub struct TaskRepo<'a> {
    conn: &'a Connection,
}

impl<'a> TaskRepo<'a> {
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
    ) -> DbResult<Task> {
        validate_executor(&PlatformsRepo::new(self.conn), project_id, executor)?;

        let id = Uuid::new_v4().to_string();
        let identifier = id.clone();

        self.conn.execute(
            "INSERT INTO tasks (id, project_id, identifier, title, description, priority, executor)
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

        TaskTagsRepo::new(self.conn).replace(&id, tags)?;

        self.get(&id)?.ok_or_else(|| DbError::Internal("task missing after create".into()))
    }

    pub fn build_header(&self, task: Task) -> DbResult<TaskHeader> {
        let mut header = TaskHeader::from(task);
        header.tags = TaskTagsRepo::new(self.conn).list(&header.task_id)?;
        header.files = TaskFilesRepo::new(self.conn).list(&header.task_id)?;
        Ok(header)
    }

    pub fn get_header(&self, id: &str) -> DbResult<Option<TaskHeader>> {
        let Some(task) = self.get(id)? else {
            return Ok(None);
        };
        Ok(Some(self.build_header(task)?))
    }

    pub fn get(&self, id: &str) -> DbResult<Option<Task>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, project_id, identifier, title, description, priority,
                    board_column, executor, auto_approve_permissions, created_at, updated_at
             FROM tasks WHERE id = ?1",
        )?;

        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_task(row)?));
        }
        Ok(None)
    }

    pub fn list_by_project(&self, project_id: &str) -> DbResult<Vec<ProjectTaskListItem>> {
        let mut stmt = self.conn.prepare(&format!(
            "SELECT {ISSUE_LIST_SELECT}
             FROM tasks
             WHERE project_id = ?1
             {TASK_CARD_ORDER_BY}",
        ))?;

        let mut rows = stmt.query([project_id])?;
        let mut items = Vec::new();
        while let Some(row) = rows.next()? {
            items.push(map_task_list_item(row)?);
        }
        Ok(items)
    }

    pub fn list_by_column(
        &self,
        project_id: &str,
        column: BoardColumnId,
    ) -> DbResult<Vec<ProjectBoardTask>> {
        let mut stmt = self.conn.prepare(&format!(
            "SELECT {TASK_CARD_SELECT}
             FROM tasks
             WHERE project_id = ?1 AND board_column = ?2
             {TASK_CARD_ORDER_BY}",
        ))?;

        let mut rows = stmt.query(params![project_id, column.as_str()])?;
        let mut cards = Vec::new();
        while let Some(row) = rows.next()? {
            cards.push(map_task_card(row)?);
        }
        Ok(cards)
    }

    pub fn transition_column(&self, id: &str, column: BoardColumnId) -> DbResult<Task> {
        let changed = self.conn.execute(
            "UPDATE tasks SET board_column = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![column.as_str(), id],
        )?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("task {id}")));
        }

        self.get(id)?.ok_or_else(|| DbError::NotFound(format!("task {id}")))
    }

    pub fn set_executor(&self, id: &str, executor: Option<&str>) -> DbResult<Task> {
        let task = self
            .get(id)?
            .ok_or_else(|| DbError::NotFound(format!("task {id}")))?;
        validate_executor(
            &PlatformsRepo::new(self.conn),
            &task.project_id,
            executor,
        )?;

        let changed = self.conn.execute(
            "UPDATE tasks SET executor = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![executor, id],
        )?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("task {id}")));
        }

        self.get(id)?.ok_or_else(|| DbError::NotFound(format!("task {id}")))
    }

    pub fn set_auto_approve_permissions(&self, id: &str, auto_approve: bool) -> DbResult<Task> {
        let changed = self.conn.execute(
            "UPDATE tasks SET auto_approve_permissions = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![i32::from(auto_approve), id],
        )?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("task {id}")));
        }

        self.get(id)?.ok_or_else(|| DbError::NotFound(format!("task {id}")))
    }

    pub fn update(&self, id: &str, patch: &TaskPatch) -> DbResult<Task> {
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
                .ok_or_else(|| DbError::NotFound(format!("task {id}")));
        }

        sets.push("updated_at = datetime('now')");
        values.push(Box::new(id.to_string()));

        let sql = format!("UPDATE tasks SET {} WHERE id = ?", sets.join(", "));
        let params: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|value| value.as_ref()).collect();

        let changed = self.conn.execute(&sql, params.as_slice())?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("task {id}")));
        }

        self.get(id)?.ok_or_else(|| DbError::NotFound(format!("task {id}")))
    }

    pub fn list_candidates(&self, project_id: &str) -> DbResult<Vec<ProjectBoardTask>> {
        let mut stmt = self.conn.prepare(&format!(
            "SELECT {TASK_CARD_SELECT_ALIASED}
             FROM tasks i
             WHERE i.project_id = ?1
               AND i.board_column = ?2
               AND NOT EXISTS (
                 SELECT 1
                 FROM run_attempts ra
                 WHERE ra.task_id = i.id AND ra.status = 'succeeded'
               )
             {TASK_CARD_ORDER_BY_ALIASED}",
        ))?;

        let mut rows = stmt.query(params![project_id, BoardColumnId::Backlog.as_str()])?;
        let mut cards = Vec::new();
        while let Some(row) = rows.next()? {
            cards.push(map_task_card(row)?);
        }
        Ok(cards)
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

fn map_task(row: &Row<'_>) -> rusqlite::Result<Task> {
    let board_column: String = row.get(6)?;
    Ok(Task {
        id: row.get(0)?,
        project_id: row.get(1)?,
        identifier: row.get(2)?,
        title: row.get(3)?,
        description: row.get(4)?,
        priority: row.get(5)?,
        board_column: parse_board_column(&board_column)
            .map_err(|err| rusqlite::Error::InvalidColumnType(6, err.to_string(), rusqlite::types::Type::Text))?,
        executor: row.get(7)?,
        auto_approve_permissions: row.get::<_, i32>(8)? != 0,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn read_board_task_fields(row: &Row<'_>, executor_index: usize) -> rusqlite::Result<ProjectBoardTask> {
    Ok(ProjectBoardTask {
        task_id: row.get(0)?,
        identifier: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        priority: row.get(4)?,
        executor: row.get(executor_index)?,
    })
}

fn map_task_card(row: &Row<'_>) -> rusqlite::Result<ProjectBoardTask> {
    read_board_task_fields(row, 5)
}

fn map_task_list_item(row: &Row<'_>) -> rusqlite::Result<ProjectTaskListItem> {
    let card = read_board_task_fields(row, 6)?;
    let board_column: String = row.get(5)?;
    Ok(ProjectTaskListItem {
        task_id: card.task_id,
        identifier: card.identifier,
        title: card.title,
        description: card.description,
        priority: card.priority,
        executor: card.executor,
        board_column: parse_board_column(&board_column)
            .map_err(|err| rusqlite::Error::InvalidColumnType(5, err.to_string(), rusqlite::types::Type::Text))?,
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
    fn create_task_rejects_unassigned_executor() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");

        let err = TaskRepo::new(&conn)
            .create(&fixtures.project_id, "Bad executor", None, Some("codex"), None, &[])
            .expect_err("reject");

        assert!(err.to_string().contains("not assigned"));
    }

    #[test]
    fn list_project_and_candidate_queries_include_executor() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");

        let task = TaskRepo::new(&conn)
            .create(
                &fixtures.project_id,
                "Dispatch me",
                None,
                Some("hermes"),
                None,
                &[],
            )
            .expect("create task");

        let list_items = TaskRepo::new(&conn)
            .list_by_project(&fixtures.project_id)
            .expect("list project tasks");
        assert_eq!(list_items.len(), 1);
        assert_eq!(list_items[0].task_id, task.id);
        assert_eq!(list_items[0].executor.as_deref(), Some("hermes"));

        let candidates = TaskRepo::new(&conn)
            .list_candidates(&fixtures.project_id)
            .expect("list candidates");
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].task_id, task.id);
        assert_eq!(candidates[0].executor.as_deref(), Some("hermes"));
    }
}

use std::str::FromStr;

use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::db::repos::platforms::write_platforms;
use crate::types::{CreateProjectParams, PermissionMode, Platform, Project, ProjectPatch, ProjectSummary};
use crate::utils::{parse_permission_mode, permission_mode_as_str, slugify};

pub struct ProjectRepo<'a> {
    conn: &'a Connection,
}

impl<'a> ProjectRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create(&self, params: &CreateProjectParams) -> DbResult<Project> {
        let id = Uuid::new_v4().to_string();
        let slug = slugify(&params.name);
        let tx = self.conn.unchecked_transaction()?;
        tx.execute(
            "INSERT INTO projects (
                id, name, slug, workspace_root, prompt_template, poll_interval_ms,
                max_concurrency, retry_max_attempts, retry_backoff_ms, permission_mode,
                use_worktrees
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                params.name,
                slug,
                params.workspace_root,
                params.prompt_template,
                params.poll_interval_ms,
                params.max_concurrency,
                params.retry_max_attempts,
                params.retry_backoff_ms,
                permission_mode_as_str(params.permission_mode),
                i32::from(params.use_worktrees),
            ],
        )?;
        for platform_id in &params.platforms {
            Platform::from_str(platform_id).map_err(DbError::Internal)?;
        }
        write_platforms(&tx, &id, &params.platforms)?;
        tx.commit()?;
        self.get(&id)?.ok_or_else(|| DbError::Internal("project missing after create".into()))
    }

    pub fn get(&self, id: &str) -> DbResult<Option<Project>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, slug, workspace_root, prompt_template, poll_interval_ms,
                    max_concurrency, retry_max_attempts, retry_backoff_ms, permission_mode,
                    use_worktrees, orchestrator_status, created_at, updated_at
             FROM projects WHERE id = ?1",
        )?;

        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(map_project(row)?));
        }
        Ok(None)
    }

    pub fn list_summaries(&self) -> DbResult<Vec<ProjectSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, slug, orchestrator_status
             FROM projects
             ORDER BY name ASC",
        )?;
        let mut rows = stmt.query([])?;
        let mut summaries = Vec::new();
        while let Some(row) = rows.next()? {
            summaries.push(ProjectSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                slug: row.get(2)?,
                orchestrator_status: row.get(3)?,
            });
        }
        Ok(summaries)
    }

    pub fn list_permission_modes(&self) -> DbResult<Vec<(String, PermissionMode)>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, permission_mode FROM projects ORDER BY name ASC",
        )?;
        let mut rows = stmt.query([])?;
        let mut modes = Vec::new();
        while let Some(row) = rows.next()? {
            let id: String = row.get(0)?;
            let permission_mode: String = row.get(1)?;
            modes.push((id, parse_permission_mode(&permission_mode)?));
        }
        Ok(modes)
    }

    pub fn update(&self, id: &str, patch: &ProjectPatch) -> DbResult<Project> {
        let mut sets = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(name) = &patch.name {
            sets.push("name = ?");
            values.push(Box::new(name.clone()));
        }
        if let Some(workspace_root) = &patch.workspace_root {
            sets.push("workspace_root = ?");
            values.push(Box::new(workspace_root.clone()));
        }
        if let Some(prompt_template) = &patch.prompt_template {
            sets.push("prompt_template = ?");
            values.push(Box::new(prompt_template.clone()));
        }
        if let Some(poll_interval_ms) = patch.poll_interval_ms {
            sets.push("poll_interval_ms = ?");
            values.push(Box::new(poll_interval_ms));
        }
        if let Some(max_concurrency) = patch.max_concurrency {
            sets.push("max_concurrency = ?");
            values.push(Box::new(max_concurrency));
        }
        if let Some(retry_max_attempts) = patch.retry_max_attempts {
            sets.push("retry_max_attempts = ?");
            values.push(Box::new(retry_max_attempts));
        }
        if let Some(retry_backoff_ms) = patch.retry_backoff_ms {
            sets.push("retry_backoff_ms = ?");
            values.push(Box::new(retry_backoff_ms));
        }
        if let Some(permission_mode) = patch.permission_mode {
            sets.push("permission_mode = ?");
            values.push(Box::new(permission_mode_as_str(permission_mode).to_string()));
        }
        if let Some(use_worktrees) = patch.use_worktrees {
            sets.push("use_worktrees = ?");
            values.push(Box::new(i32::from(use_worktrees)));
        }
        if let Some(orchestrator_status) = &patch.orchestrator_status {
            sets.push("orchestrator_status = ?");
            values.push(Box::new(orchestrator_status.clone()));
        }

        if sets.is_empty() {
            return self
                .get(id)?
                .ok_or_else(|| DbError::NotFound(format!("project {id}")));
        }

        sets.push("updated_at = datetime('now')");
        values.push(Box::new(id.to_string()));

        let sql = format!("UPDATE projects SET {} WHERE id = ?", sets.join(", "));
        let params: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|value| value.as_ref()).collect();

        let changed = self.conn.execute(&sql, params.as_slice())?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("project {id}")));
        }

        self.get(id)?.ok_or_else(|| DbError::NotFound(format!("project {id}")))
    }

    pub fn delete(&self, id: &str) -> DbResult<()> {
        let changed = self.conn.execute("DELETE FROM projects WHERE id = ?1", [id])?;
        if changed == 0 {
            return Err(DbError::NotFound(format!("project {id}")));
        }
        Ok(())
    }
}

fn map_project(row: &Row<'_>) -> rusqlite::Result<Project> {
    let permission_mode: String = row.get(9)?;
    let use_worktrees: i32 = row.get(10)?;
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        slug: row.get(2)?,
        workspace_root: row.get(3)?,
        prompt_template: row.get(4)?,
        poll_interval_ms: row.get(5)?,
        max_concurrency: row.get(6)?,
        retry_max_attempts: row.get(7)?,
        retry_backoff_ms: row.get(8)?,
        permission_mode: parse_permission_mode(&permission_mode)
            .map_err(|err| rusqlite::Error::InvalidColumnType(9, err.to_string(), rusqlite::types::Type::Text))?,
        use_worktrees: use_worktrees != 0,
        orchestrator_status: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::types::{PermissionMode, Project, ProjectPatch, ProjectSummary};

pub struct ProjectRepo<'a> {
    conn: &'a Connection,
}

impl<'a> ProjectRepo<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create(&self, name: &str) -> DbResult<Project> {
        let id = Uuid::new_v4().to_string();
        let slug = slugify(name);
        self.conn.execute(
            "INSERT INTO projects (id, name, slug) VALUES (?1, ?2, ?3)",
            params![id, name, slug],
        )?;
        self.get(&id)?.ok_or_else(|| DbError::Internal("project missing after create".into()))
    }

    pub fn get(&self, id: &str) -> DbResult<Option<Project>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, slug, workspace_root, workflow_source, workflow_file_path,
                    workflow_file_mtime, workflow_version, workflow_last_loaded_at,
                    max_concurrency, retry_max_attempts, retry_backoff_ms, prompt_template,
                    poll_interval_ms, permission_mode, orchestrator_status, created_at, updated_at
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
            modes.push((
                id,
                parse_permission_mode(&permission_mode)?,
            ));
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
        if let Some(workflow_source) = &patch.workflow_source {
            sets.push("workflow_source = ?");
            values.push(Box::new(workflow_source.clone()));
        }
        if let Some(path) = &patch.workflow_file_path {
            sets.push("workflow_file_path = ?");
            values.push(Box::new(path.clone()));
        }
        if let Some(mtime) = &patch.workflow_file_mtime {
            sets.push("workflow_file_mtime = ?");
            values.push(Box::new(mtime.clone()));
        }
        if patch.workflow_file_path.is_some() || patch.workflow_file_mtime.is_some() {
            sets.push("workflow_last_loaded_at = datetime('now')");
        }
        if let Some(version) = &patch.workflow_version {
            sets.push("workflow_version = ?");
            values.push(Box::new(version.clone()));
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

        let sql = format!(
            "UPDATE projects SET {} WHERE id = ?",
            sets.join(", ")
        );
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
    let permission_mode: String = row.get(14)?;
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        slug: row.get(2)?,
        workspace_root: row.get(3)?,
        workflow_source: row.get(4)?,
        workflow_file_path: row.get(5)?,
        workflow_file_mtime: row.get(6)?,
        workflow_version: row.get(7)?,
        workflow_last_loaded_at: row.get(8)?,
        max_concurrency: row.get(9)?,
        retry_max_attempts: row.get(10)?,
        retry_backoff_ms: row.get(11)?,
        prompt_template: row.get(12)?,
        poll_interval_ms: row.get(13)?,
        permission_mode: parse_permission_mode(&permission_mode)
            .map_err(|err| rusqlite::Error::InvalidColumnType(14, err.to_string(), rusqlite::types::Type::Text))?,
        orchestrator_status: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

fn slugify(name: &str) -> String {
    let mut slug = String::new();
    let mut last_was_hyphen = true;

    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            last_was_hyphen = false;
        } else if !last_was_hyphen {
            slug.push('-');
            last_was_hyphen = true;
        }
    }

    if slug.ends_with('-') {
        slug.pop();
    }

    if slug.is_empty() {
        "project".into()
    } else {
        slug
    }
}

fn permission_mode_as_str(mode: PermissionMode) -> &'static str {
    match mode {
        PermissionMode::AutoApprove => "autoApprove",
        PermissionMode::RequiresApproval => "requiresApproval",
    }
}

fn parse_permission_mode(value: &str) -> DbResult<PermissionMode> {
    match value {
        "autoApprove" => Ok(PermissionMode::AutoApprove),
        "requiresApproval" => Ok(PermissionMode::RequiresApproval),
        _ => Err(DbError::Internal(format!("unknown permission mode: {value}"))),
    }
}


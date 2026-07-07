use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::error::{DbError, DbResult};
use crate::types::PermissionMode;

pub struct Project {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub workspace_root: Option<String>,
    pub workflow_source: Option<String>,
    pub workflow_file_path: Option<String>,
    pub workflow_file_mtime: Option<String>,
    pub workflow_version: Option<String>,
    pub workflow_last_loaded_at: Option<String>,
    pub max_concurrency: i32,
    pub retry_max_attempts: i32,
    pub retry_backoff_ms: i32,
    pub prompt_template: String,
    pub poll_interval_ms: i32,
    pub permission_mode: PermissionMode,
    pub orchestrator_status: String,
    pub created_at: String,
    pub updated_at: String,
}

pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub orchestrator_status: String,
}

#[derive(Default)]
pub struct ProjectPatch {
    pub name: Option<String>,
    pub workflow_source: Option<String>,
    pub workflow_file_path: Option<String>,
    pub workflow_file_mtime: Option<String>,
    pub workflow_version: Option<String>,
    pub prompt_template: Option<String>,
    pub poll_interval_ms: Option<i32>,
    pub max_concurrency: Option<i32>,
    pub retry_max_attempts: Option<i32>,
    pub retry_backoff_ms: Option<i32>,
    pub permission_mode: Option<PermissionMode>,
    pub orchestrator_status: Option<String>,
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::open_test_db;

    #[test]
    fn create_generates_slug_from_name() {
        let conn = open_test_db().expect("open test db");
        let repo = ProjectRepo::new(&conn);
        let project = repo.create("My Test Project").expect("create project");

        assert_eq!(project.slug, "my-test-project");
        assert_eq!(project.name, "My Test Project");
        assert_eq!(project.poll_interval_ms, 3000);
        assert_eq!(project.permission_mode, PermissionMode::RequiresApproval);
        assert_eq!(project.orchestrator_status, "idle");
    }

    #[test]
    fn list_summaries_returns_projects() {
        let conn = open_test_db().expect("open test db");
        let repo = ProjectRepo::new(&conn);
        repo.create("Alpha").expect("create alpha");
        repo.create("Beta").expect("create beta");

        let summaries = repo.list_summaries().expect("list summaries");
        assert_eq!(summaries.len(), 2);
        assert_eq!(summaries[0].name, "Alpha");
        assert_eq!(summaries[1].name, "Beta");
    }

    #[test]
    fn update_applies_patch_fields() {
        let conn = open_test_db().expect("open test db");
        let repo = ProjectRepo::new(&conn);
        let project = repo.create("Config Project").expect("create project");

        let updated = repo
            .update(
                &project.id,
                &ProjectPatch {
                    name: Some("Renamed Project".into()),
                    prompt_template: Some("do work".into()),
                    poll_interval_ms: Some(5000),
                    permission_mode: Some(PermissionMode::AutoApprove),
                    retry_max_attempts: Some(5),
                    retry_backoff_ms: Some(1000),
                    ..ProjectPatch::default()
                },
            )
            .expect("update project");

        assert_eq!(updated.name, "Renamed Project");
        assert_eq!(updated.prompt_template, "do work");
        assert_eq!(updated.poll_interval_ms, 5000);
        assert_eq!(updated.permission_mode, PermissionMode::AutoApprove);
        assert_eq!(updated.retry_max_attempts, 5);
        assert_eq!(updated.retry_backoff_ms, 1000);
    }

    #[test]
    fn update_workflow_file_sets_loaded_at() {
        let conn = open_test_db().expect("open test db");
        let repo = ProjectRepo::new(&conn);
        let project = repo.create("Workflow Project").expect("create project");
        assert!(project.workflow_last_loaded_at.is_none());

        let updated = repo
            .update(
                &project.id,
                &ProjectPatch {
                    workflow_file_path: Some("/tmp/workflow.yaml".into()),
                    workflow_file_mtime: Some("2026-01-01T00:00:00Z".into()),
                    ..ProjectPatch::default()
                },
            )
            .expect("update workflow file");

        assert_eq!(
            updated.workflow_file_path.as_deref(),
            Some("/tmp/workflow.yaml")
        );
        assert!(updated.workflow_last_loaded_at.is_some());
    }

    #[test]
    fn delete_removes_project() {
        let conn = open_test_db().expect("open test db");
        let repo = ProjectRepo::new(&conn);
        let project = repo.create("Delete Me").expect("create project");

        repo.delete(&project.id).expect("delete project");
        assert!(repo.get(&project.id).expect("get project").is_none());
    }

    #[test]
    fn delete_missing_project_returns_not_found() {
        let conn = open_test_db().expect("open test db");
        let repo = ProjectRepo::new(&conn);
        let err = repo.delete("missing-project").expect_err("delete missing");
        assert!(matches!(err, DbError::NotFound(_)));
    }
}

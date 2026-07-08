use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use rusqlite::Connection;

use crate::types::{PermissionMode, Project, ProjectPatch};

use super::error::{DbError, DbResult};
use super::repos::project::ProjectRepo;

pub struct ParsedWorkflow {
    pub prompt_template: String,
    pub poll_interval_ms: Option<i32>,
    pub max_concurrency: Option<i32>,
    pub retry_max_attempts: Option<i32>,
    pub retry_backoff_ms: Option<i32>,
    pub permission_mode: Option<PermissionMode>,
}

pub fn project_dir(app_data_dir: &Path, project_id: &str) -> PathBuf {
    app_data_dir.join("projects").join(project_id)
}

pub fn project_workflow_path(app_data_dir: &Path, project_id: &str) -> PathBuf {
    project_dir(app_data_dir, project_id).join("workflow.yaml")
}

pub fn compute_workflow_version(path: &Path) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    let mtime_ms = meta.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_millis();
    Some(format!("{mtime_ms}:{}", meta.len()))
}

pub fn file_mtime_rfc3339(path: &Path) -> Option<String> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    let datetime: chrono::DateTime<chrono::Utc> = modified.into();
    Some(datetime.to_rfc3339())
}

pub fn parse_workflow_content(content: &str) -> ParsedWorkflow {
    let (front_matter, body) = split_workflow(content);
    let mut fields = ParsedWorkflow {
        prompt_template: body.to_string(),
        poll_interval_ms: None,
        max_concurrency: None,
        retry_max_attempts: None,
        retry_backoff_ms: None,
        permission_mode: None,
    };

    for line in front_matter.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let Some((key, value)) = trimmed.split_once(':') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim().trim_matches('"').trim_matches('\'');
        match key {
            "poll_interval_ms" => fields.poll_interval_ms = value.parse().ok(),
            "max_concurrency" => fields.max_concurrency = value.parse().ok(),
            "retry_max_attempts" => fields.retry_max_attempts = value.parse().ok(),
            "retry_backoff_ms" => fields.retry_backoff_ms = value.parse().ok(),
            "permission_mode" => fields.permission_mode = parse_permission_mode(value),
            _ => {}
        }
    }

    fields
}

pub fn apply_workflow_file(
    conn: &Connection,
    project_id: &str,
    path: &Path,
    workflow_source: Option<&str>,
) -> DbResult<Project> {
    let content = fs::read_to_string(path).map_err(|err| DbError::Internal(err.to_string()))?;
    let fields = parse_workflow_content(&content);
    let path_str = path.to_string_lossy().into_owned();

    ProjectRepo::new(conn).update(
        project_id,
        &ProjectPatch {
            workflow_source: workflow_source.map(str::to_string),
            workflow_file_path: Some(path_str),
            workflow_file_mtime: file_mtime_rfc3339(path),
            workflow_version: compute_workflow_version(path),
            prompt_template: Some(fields.prompt_template),
            poll_interval_ms: fields.poll_interval_ms,
            max_concurrency: fields.max_concurrency,
            retry_max_attempts: fields.retry_max_attempts,
            retry_backoff_ms: fields.retry_backoff_ms,
            permission_mode: fields.permission_mode,
            ..ProjectPatch::default()
        },
    )
}

fn split_workflow(content: &str) -> (&str, &str) {
    let trimmed = content.trim_start();
    let Some(rest) = trimmed.strip_prefix("---") else {
        return ("", trimmed);
    };
    let rest = rest.trim_start_matches('\n');
    let Some((front_matter, body)) = rest.split_once("\n---") else {
        return ("", trimmed);
    };
    (front_matter, body.trim_start_matches('\n').trim())
}

pub fn workflow_changed_on_disk(project: &Project) -> bool {
    let Some(path) = project.workflow_file_path.as_deref() else {
        return false;
    };
    let Some(disk_version) = compute_workflow_version(Path::new(path)) else {
        return false;
    };
    project.workflow_version.as_deref() != Some(disk_version.as_str())
}

fn parse_permission_mode(value: &str) -> Option<PermissionMode> {
    match value {
        "autoApprove" | "auto_approve" => Some(PermissionMode::AutoApprove),
        "requiresApproval" | "requires_approval" => Some(PermissionMode::RequiresApproval),
        _ => None,
    }
}


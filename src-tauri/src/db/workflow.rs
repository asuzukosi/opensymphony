use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use rusqlite::Connection;

use crate::types::{PermissionMode, Project};
use crate::utils::{parse_permission_mode_optional, project_data_dir};

use super::error::{DbError, DbResult};

pub struct ParsedWorkflow {
    pub prompt_template: String,
    pub poll_interval_ms: Option<i32>,
    pub max_concurrency: Option<i32>,
    pub retry_max_attempts: Option<i32>,
    pub retry_backoff_ms: Option<i32>,
    pub permission_mode: Option<PermissionMode>,
}

pub fn project_dir(app_data_dir: &Path, project_id: &str) -> PathBuf {
    project_data_dir(app_data_dir, project_id)
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
            "permission_mode" => fields.permission_mode = parse_permission_mode_optional(value),
            _ => {}
        }
    }

    fields
}

pub fn apply_workflow_file(
    _conn: &Connection,
    _project_id: &str,
    _path: &Path,
    _workflow_source: Option<&str>,
) -> DbResult<Project> {
    Err(DbError::Internal("workflow yaml is no longer supported".into()))
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

pub fn workflow_changed_on_disk(_project: &Project) -> bool {
    false
}


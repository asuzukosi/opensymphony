use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};

use crate::db::error::DbError;
use crate::db::repos::project::ProjectRepo;
use crate::db::Db;
use crate::types::{PermissionMode, Project, ProjectPatch, ProjectSummary, RetryPolicy};

const REFERENCE_WORKFLOW: &str = include_str!("../../resources/reference-workflow.yaml");

// reads

#[tauri::command(rename = "opensymphony:list-project-summaries")]
pub fn list_project_summaries(db: State<Db>) -> Result<Vec<ProjectSummary>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    ProjectRepo::new(&conn)
        .list_summaries()
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:get-project-name")]
pub fn get_project_name(db: State<Db>, project_id: String) -> Result<String, String> {
    Ok(require_project(db, &project_id)?.name)
}

#[tauri::command(rename = "opensymphony:get-project-workflow-source")]
pub fn get_project_workflow_source(
    db: State<Db>,
    project_id: String,
) -> Result<Option<String>, String> {
    Ok(require_project(db, &project_id)?.workflow_source)
}

#[tauri::command(rename = "opensymphony:get-project-workflow-file-path")]
pub fn get_project_workflow_file_path(
    db: State<Db>,
    project_id: String,
) -> Result<Option<String>, String> {
    Ok(require_project(db, &project_id)?.workflow_file_path)
}

#[tauri::command(rename = "opensymphony:get-project-workflow-version")]
pub fn get_project_workflow_version(
    db: State<Db>,
    project_id: String,
) -> Result<Option<String>, String> {
    Ok(require_project(db, &project_id)?.workflow_version)
}

#[tauri::command(rename = "opensymphony:get-project-prompt-template")]
pub fn get_project_prompt_template(db: State<Db>, project_id: String) -> Result<String, String> {
    Ok(require_project(db, &project_id)?.prompt_template)
}

#[tauri::command(rename = "opensymphony:get-project-poll-interval")]
pub fn get_project_poll_interval(db: State<Db>, project_id: String) -> Result<u32, String> {
    Ok(require_project(db, &project_id)?.poll_interval_ms as u32)
}

#[tauri::command(rename = "opensymphony:get-project-max-concurrency")]
pub fn get_project_max_concurrency(db: State<Db>, project_id: String) -> Result<i32, String> {
    Ok(require_project(db, &project_id)?.max_concurrency)
}

#[tauri::command(rename = "opensymphony:get-project-retry-policy")]
pub fn get_project_retry_policy(db: State<Db>, project_id: String) -> Result<RetryPolicy, String> {
    let project = require_project(db, &project_id)?;
    Ok(RetryPolicy {
        max_attempts: project.retry_max_attempts,
        backoff_ms: project.retry_backoff_ms,
    })
}

#[tauri::command(rename = "opensymphony:get-project-permission-mode")]
pub fn get_project_permission_mode(
    db: State<Db>,
    project_id: String,
) -> Result<PermissionMode, String> {
    Ok(require_project(db, &project_id)?.permission_mode)
}

#[tauri::command(rename = "opensymphony:get-project-orchestrator-status")]
pub fn get_project_orchestrator_status(db: State<Db>, project_id: String) -> Result<String, String> {
    Ok(require_project(db, &project_id)?.orchestrator_status)
}

// writes

#[tauri::command(rename = "opensymphony:create-project")]
pub fn create_project(app: AppHandle, db: State<Db>, name: String) -> Result<ProjectSummary, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let project = ProjectRepo::new(&conn)
        .create(&name)
        .map_err(|err| err.to_string())?;
    install_workflow_content(&app, &conn, &project.id, REFERENCE_WORKFLOW, "bundled")?;
    project_summary(&conn, &project.id)
}

#[tauri::command(rename = "opensymphony:delete-project")]
pub fn delete_project(app: AppHandle, db: State<Db>, project_id: String) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    ProjectRepo::new(&conn)
        .delete(&project_id)
        .map_err(|err| err.to_string())?;

    if let Ok(project_dir) = project_dir(&app, &project_id) {
        let _ = fs::remove_dir_all(project_dir);
    }
    Ok(())
}

#[tauri::command(rename = "opensymphony:set-project-name")]
pub fn set_project_name(
    db: State<Db>,
    project_id: String,
    name: String,
) -> Result<String, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let project = ProjectRepo::new(&conn)
        .update(
            &project_id,
            &ProjectPatch {
                name: Some(name),
                ..ProjectPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;
    Ok(project.name)
}

#[tauri::command(rename = "opensymphony:set-project-workflow-file")]
pub fn set_project_workflow_file(
    app: AppHandle,
    db: State<Db>,
    project_id: String,
    source_path: String,
) -> Result<Option<String>, String> {
    install_workflow_from_path(&app, db, &project_id, &source_path, "file")
}

#[tauri::command(rename = "opensymphony:import-project-workflow-file")]
pub fn import_project_workflow_file(
    app: AppHandle,
    db: State<Db>,
    project_id: String,
    source_path: String,
) -> Result<Option<String>, String> {
    install_workflow_from_path(&app, db, &project_id, &source_path, "import")
}

#[tauri::command(rename = "opensymphony:set-project-prompt-template")]
pub fn set_project_prompt_template(
    db: State<Db>,
    project_id: String,
    prompt_template: String,
) -> Result<String, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let project = ProjectRepo::new(&conn)
        .update(
            &project_id,
            &ProjectPatch {
                prompt_template: Some(prompt_template),
                ..ProjectPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;
    Ok(project.prompt_template)
}

#[tauri::command(rename = "opensymphony:set-project-poll-interval")]
pub fn set_project_poll_interval(
    db: State<Db>,
    project_id: String,
    poll_interval_ms: i32,
) -> Result<u32, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let project = ProjectRepo::new(&conn)
        .update(
            &project_id,
            &ProjectPatch {
                poll_interval_ms: Some(poll_interval_ms),
                ..ProjectPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;
    Ok(project.poll_interval_ms as u32)
}

#[tauri::command(rename = "opensymphony:set-project-max-concurrency")]
pub fn set_project_max_concurrency(
    db: State<Db>,
    project_id: String,
    max_concurrency: i32,
) -> Result<i32, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let project = ProjectRepo::new(&conn)
        .update(
            &project_id,
            &ProjectPatch {
                max_concurrency: Some(max_concurrency),
                ..ProjectPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;
    Ok(project.max_concurrency)
}

#[tauri::command(rename = "opensymphony:set-project-retry-policy")]
pub fn set_project_retry_policy(
    db: State<Db>,
    project_id: String,
    max_attempts: i32,
    backoff_ms: i32,
) -> Result<RetryPolicy, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let project = ProjectRepo::new(&conn)
        .update(
            &project_id,
            &ProjectPatch {
                retry_max_attempts: Some(max_attempts),
                retry_backoff_ms: Some(backoff_ms),
                ..ProjectPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;
    Ok(RetryPolicy {
        max_attempts: project.retry_max_attempts,
        backoff_ms: project.retry_backoff_ms,
    })
}

#[tauri::command(rename = "opensymphony:set-project-permission-mode")]
pub fn set_project_permission_mode(
    db: State<Db>,
    project_id: String,
    permission_mode: PermissionMode,
) -> Result<PermissionMode, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let project = ProjectRepo::new(&conn)
        .update(
            &project_id,
            &ProjectPatch {
                permission_mode: Some(permission_mode),
                ..ProjectPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;
    Ok(project.permission_mode)
}

fn require_project(db: State<Db>, project_id: &str) -> Result<Project, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    ProjectRepo::new(&conn)
        .get(project_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| DbError::NotFound(format!("project {project_id}")).to_string())
}

fn project_summary(
    conn: &rusqlite::Connection,
    project_id: &str,
) -> Result<ProjectSummary, String> {
    ProjectRepo::new(conn)
        .get(project_id)
        .map_err(|err| err.to_string())?
        .map(|project| ProjectSummary {
            id: project.id,
            name: project.name,
            slug: project.slug,
            orchestrator_status: project.orchestrator_status,
        })
        .ok_or_else(|| DbError::NotFound(format!("project {project_id}")).to_string())
}

fn project_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?;
    Ok(app_data.join("projects").join(project_id))
}

fn project_workflow_path(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    Ok(project_dir(app, project_id)?.join("workflow.yaml"))
}

fn install_workflow_from_path(
    app: &AppHandle,
    db: State<Db>,
    project_id: &str,
    source_path: &str,
    workflow_source: &str,
) -> Result<Option<String>, String> {
    let content = fs::read_to_string(source_path).map_err(|err| err.to_string())?;
    let conn = db.conn().map_err(|err| err.to_string())?;
    install_workflow_content(app, &conn, project_id, &content, workflow_source)
}

fn install_workflow_content(
    app: &AppHandle,
    conn: &rusqlite::Connection,
    project_id: &str,
    content: &str,
    workflow_source: &str,
) -> Result<Option<String>, String> {
    let dest = project_workflow_path(app, project_id)?;
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(&dest, content).map_err(|err| err.to_string())?;

    let mtime = fs::metadata(&dest)
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(|time| {
            let datetime: chrono::DateTime<chrono::Utc> = time.into();
            Some(datetime.to_rfc3339())
        });

    let fields = parse_workflow_content(content);
    let dest_str = dest.to_string_lossy().into_owned();

    ProjectRepo::new(conn)
        .update(
            project_id,
            &ProjectPatch {
                workflow_source: Some(workflow_source.into()),
                workflow_file_path: Some(dest_str.clone()),
                workflow_file_mtime: mtime,
                prompt_template: Some(fields.prompt_template),
                poll_interval_ms: fields.poll_interval_ms,
                max_concurrency: fields.max_concurrency,
                retry_max_attempts: fields.retry_max_attempts,
                retry_backoff_ms: fields.retry_backoff_ms,
                permission_mode: fields.permission_mode,
                ..ProjectPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;

    Ok(Some(dest_str))
}

struct ParsedWorkflow {
    prompt_template: String,
    poll_interval_ms: Option<i32>,
    max_concurrency: Option<i32>,
    retry_max_attempts: Option<i32>,
    retry_backoff_ms: Option<i32>,
    permission_mode: Option<PermissionMode>,
}

fn parse_workflow_content(content: &str) -> ParsedWorkflow {
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

fn parse_permission_mode(value: &str) -> Option<PermissionMode> {
    match value {
        "autoApprove" | "auto_approve" => Some(PermissionMode::AutoApprove),
        "requiresApproval" | "requires_approval" => Some(PermissionMode::RequiresApproval),
        _ => None,
    }
}

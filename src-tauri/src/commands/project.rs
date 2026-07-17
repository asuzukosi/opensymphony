use std::sync::Arc;
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use tauri::{AppHandle, Manager, State};

use crate::commands::runtime::{try_dispatch_if_active, SharedManager};
use crate::db::error::DbError;
use crate::db::repos::project::ProjectRepo;
use crate::db::Db;
use crate::types::{
    CreateProjectParams, CreateProjectRequest, Project, ProjectPatch, ProjectSummary,
    Platform, RetryPolicy,
};
use crate::utils::{install_status, project_data_dir};

// reads

#[tauri::command(rename = "opensymphony:list-project-summaries")]
pub fn list_project_summaries(db: State<Arc<Db>>) -> Result<Vec<ProjectSummary>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    ProjectRepo::new(&conn)
        .list_summaries()
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:get-project-max-concurrency")]
pub fn get_project_max_concurrency(db: State<Arc<Db>>, project_id: String) -> Result<i32, String> {
    Ok(require_project(db, &project_id)?.max_concurrency)
}

#[tauri::command(rename = "opensymphony:get-project-retry-policy")]
pub fn get_project_retry_policy(db: State<Arc<Db>>, project_id: String) -> Result<RetryPolicy, String> {
    let project = require_project(db, &project_id)?;
    Ok(RetryPolicy {
        max_attempts: project.retry_max_attempts,
        backoff_ms: project.retry_backoff_ms,
    })
}

// writes

#[tauri::command(rename = "opensymphony:create-project")]
pub fn create_project(
    db: State<Arc<Db>>,
    input: CreateProjectRequest,
) -> Result<ProjectSummary, String> {
    let params = validate_create_project_request(input)?;
    let conn = db.conn().map_err(|err| err.to_string())?;
    let project = ProjectRepo::new(&conn)
        .create(&params)
        .map_err(|err| err.to_string())?;
    project_summary(&conn, &project.id)
}

#[tauri::command(rename = "opensymphony:delete-project")]
pub fn delete_project(app: AppHandle, db: State<Arc<Db>>, project_id: String) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    ProjectRepo::new(&conn)
        .delete(&project_id)
        .map_err(|err| err.to_string())?;

    if let Ok(dir) = project_data_dir_for_delete(&app, &project_id) {
        let _ = fs::remove_dir_all(dir);
    }
    Ok(())
}

#[tauri::command(rename = "opensymphony:set-project-name")]
pub fn set_project_name(
    db: State<Arc<Db>>,
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

#[tauri::command(rename = "opensymphony:set-project-max-concurrency")]
pub fn set_project_max_concurrency(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
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
    try_dispatch_if_active(&conn, &manager, &project_id)?;
    Ok(project.max_concurrency)
}

#[tauri::command(rename = "opensymphony:set-project-retry-policy")]
pub fn set_project_retry_policy(
    db: State<Arc<Db>>,
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

fn require_project(db: State<Arc<Db>>, project_id: &str) -> Result<Project, String> {
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

fn project_data_dir_for_delete(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?;
    Ok(project_data_dir(&app_data, project_id))
}

fn validate_create_project_request(request: CreateProjectRequest) -> Result<CreateProjectParams, String> {
    let name = request.name.trim();
    if name.is_empty() {
        return Err("project name is required".into());
    }

    let workspace_root = validate_workspace_root(&request.workspace_root)?;

    let prompt_template = request.prompt_template.trim();
    if prompt_template.is_empty() {
        return Err("prompt template cannot be empty".into());
    }

    if request.platforms.is_empty() {
        return Err("select at least one platform".into());
    }
    for platform_id in &request.platforms {
        let platform = Platform::from_str(platform_id).map_err(|err| err.to_string())?;
        let status = install_status(platform);
        if !status.installed {
            return Err(format!(
                "platform {platform_id} is not installed (missing: {})",
                status.missing_binaries.join(", ")
            ));
        }
    }

    if request.max_concurrency < 1 {
        return Err("max concurrency must be at least 1".into());
    }
    if request.retry_max_attempts < 1 {
        return Err("max attempts must be at least 1".into());
    }
    if request.retry_backoff_ms < 0 {
        return Err("backoff must be at least 0".into());
    }

    let use_worktrees =
        resolve_use_worktrees(request.use_per_task_workspaces, request.use_worktrees);

    Ok(CreateProjectParams {
        name: name.to_string(),
        workspace_root,
        prompt_template: prompt_template.to_string(),
        use_per_task_workspaces: request.use_per_task_workspaces,
        use_worktrees,
        max_concurrency: request.max_concurrency,
        retry_max_attempts: request.retry_max_attempts,
        retry_backoff_ms: request.retry_backoff_ms,
        platforms: request.platforms,
    })
}

fn validate_workspace_root(workspace_root: &str) -> Result<String, String> {
    let workspace_root = workspace_root.trim();
    if workspace_root.is_empty() {
        return Err("workspace folder is required".into());
    }
    if !Path::new(workspace_root).is_dir() {
        return Err(format!("workspace folder does not exist: {workspace_root}"));
    }
    Ok(workspace_root.to_string())
}

fn resolve_use_worktrees(use_per_task_workspaces: bool, use_worktrees: bool) -> bool {
    if use_per_task_workspaces {
        use_worktrees
    } else {
        false
    }
}

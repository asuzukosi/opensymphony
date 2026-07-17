use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::acp::AcpState;
use super::runtime::{on_task_column_changed, on_work_added, SharedManager};
use crate::db::error::DbError;
use crate::db::repos::comment::CommentRepo;
use crate::db::repos::task::TaskRepo;
use crate::db::repos::task_files::TaskFilesRepo;
use crate::db::repos::task_tags::TaskTagsRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::db::repos::session_event::SessionEventRepo;
use crate::db::Db;
use crate::types::{
    BoardColumnId, Task, TaskComment, TaskDetailRunAttempt, TaskFile, TaskHeader,
    TaskPatch, PendingPermission, PermissionDecision, ProjectTaskListItem, SessionEvent,
};

fn load_header(conn: &rusqlite::Connection, task: Task) -> Result<TaskHeader, String> {
    TaskRepo::new(conn)
        .build_header(task)
        .map_err(|err| err.to_string())
}

fn load_header_by_id(conn: &rusqlite::Connection, task_id: &str) -> Result<TaskHeader, String> {
    TaskRepo::new(conn)
        .get_header(task_id)?
        .ok_or_else(|| DbError::NotFound(format!("task {task_id}")).to_string())
}

// reads

#[tauri::command(rename = "opensymphony:list-project-tasks")]
pub fn list_project_tasks(
    db: State<Arc<Db>>,
    project_id: String,
) -> Result<Vec<ProjectTaskListItem>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    TaskRepo::new(&conn)
        .list_by_project(&project_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:get-task-header")]
pub fn get_task_header(db: State<Arc<Db>>, task_id: String) -> Result<TaskHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    load_header_by_id(&conn, &task_id)
}

#[tauri::command(rename = "opensymphony:list-task-comments")]
pub fn list_task_comments(
    db: State<Arc<Db>>,
    task_id: String,
) -> Result<Vec<TaskComment>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    CommentRepo::new(&conn)
        .list_by_task(&task_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:list-task-run-attempts")]
pub fn list_task_run_attempts(
    db: State<Arc<Db>>,
    task_id: String,
) -> Result<Vec<TaskDetailRunAttempt>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let attempts = RunAttemptRepo::new(&conn)
        .list_by_task(&task_id)
        .map_err(|err| err.to_string())?;
    Ok(attempts
        .into_iter()
        .map(TaskDetailRunAttempt::from)
        .collect())
}

#[tauri::command(rename = "opensymphony:list-session-events")]
pub fn list_session_events(
    db: State<Arc<Db>>,
    task_id: String,
) -> Result<Vec<SessionEvent>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    SessionEventRepo::new(&conn)
        .list_by_task(&task_id)
        .map_err(|err| err.to_string())
}

// writes

#[tauri::command(rename = "opensymphony:create-task")]
pub fn create_task(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
    title: String,
    description: Option<String>,
    executor: Option<String>,
    priority: Option<i32>,
    tags: Option<Vec<String>>,
) -> Result<TaskHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let task = TaskRepo::new(&conn).create(
        &project_id,
        &title,
        description.as_deref(),
        executor.as_deref(),
        priority,
        &tags.unwrap_or_default(),
    )?;
    let header = load_header(&conn, task)?;
    on_work_added(&conn, &manager, &project_id)?;
    Ok(header)
}

#[tauri::command(rename = "opensymphony:set-task-executor")]
pub fn set_task_executor(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    task_id: String,
    executor: Option<String>,
) -> Result<TaskHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let task = TaskRepo::new(&conn).set_executor(&task_id, executor.as_deref())?;
    let header = load_header(&conn, task.clone())?;
    if task.board_column == BoardColumnId::Backlog {
        on_work_added(&conn, &manager, &task.project_id)?;
    }
    Ok(header)
}

#[tauri::command(rename = "opensymphony:set-task-auto-approve-permissions")]
pub fn set_task_auto_approve_permissions(
    db: State<Arc<Db>>,
    task_id: String,
    auto_approve_permissions: bool,
) -> Result<TaskHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let task = TaskRepo::new(&conn).set_auto_approve_permissions(&task_id, auto_approve_permissions)?;
    load_header(&conn, task)
}

#[tauri::command(rename = "opensymphony:set-task-tags")]
pub fn set_task_tags(
    db: State<Arc<Db>>,
    task_id: String,
    tags: Vec<String>,
) -> Result<TaskHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    TaskTagsRepo::new(&conn).replace(&task_id, &tags)?;
    load_header_by_id(&conn, &task_id)
}

#[tauri::command(rename = "opensymphony:attach-task-files")]
pub fn attach_task_files(
    app: AppHandle,
    db: State<Arc<Db>>,
    task_id: String,
    source_paths: Vec<String>,
) -> Result<Vec<TaskFile>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let app_data_dir = Db::app_data_dir(&app).map_err(|err| err.to_string())?;
    TaskFilesRepo::new(&conn).attach(app_data_dir.as_path(), &task_id, &source_paths)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:update-task-priority")]
pub fn update_task_priority(
    db: State<Arc<Db>>,
    task_id: String,
    priority: Option<i32>,
) -> Result<TaskHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let task = TaskRepo::new(&conn).update(
        &task_id,
        &TaskPatch {
            priority,
            ..Default::default()
        },
    )?;
    load_header(&conn, task)
}

#[tauri::command(rename = "opensymphony:transition-task-column")]
pub fn transition_task_column(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    task_id: String,
    column: BoardColumnId,
    actor: Option<String>,
) -> Result<TaskHeader, String> {
    let _ = actor;
    let conn = db.conn().map_err(|err| err.to_string())?;
    let task = TaskRepo::new(&conn).transition_column(&task_id, column)?;
    let header = load_header(&conn, task.clone())?;
    on_task_column_changed(&conn, &manager, &task)?;
    Ok(header)
}

#[tauri::command(rename = "opensymphony:add-task-comment")]
pub fn add_task_comment(
    db: State<Arc<Db>>,
    task_id: String,
    body: String,
    author: Option<String>,
) -> Result<TaskComment, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    CommentRepo::new(&conn)
        .append(&task_id, &body, author.as_deref())
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:list-task-pending-permissions")]
pub fn list_task_pending_permissions(
    acp: State<AcpState>,
    task_id: String,
) -> Result<Vec<PendingPermission>, String> {
    Ok(acp.permission_gate.list_by_task(&task_id))
}

#[tauri::command(rename = "opensymphony:resolve-session-permission")]
pub fn resolve_session_permission(
    acp: State<AcpState>,
    permission_id: String,
    decision: PermissionDecision,
) -> Result<(), String> {
    if acp.permission_gate.resolve(&permission_id, decision) {
        Ok(())
    } else {
        Err(format!("pending permission {permission_id} not found"))
    }
}

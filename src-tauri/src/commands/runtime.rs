use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use tauri::State;

use crate::db::Db;
use crate::orchestrator::Manager;

const DEFAULT_TAIL_LIMIT: i32 = 10;

pub(crate) type SharedManager = Arc<Mutex<Manager>>;

pub(crate) fn on_work_added(
    conn: &Connection,
    manager: &SharedManager,
    project_id: &str,
) -> Result<(), String> {
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .on_work_added(conn, project_id)
        .map_err(|err| err.to_string())
}

pub(crate) fn on_issue_column_changed(
    conn: &Connection,
    manager: &SharedManager,
    issue: &crate::types::Issue,
) -> Result<(), String> {
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .on_issue_column_changed(conn, issue)
        .map_err(|err| err.to_string())
}

pub(crate) fn try_dispatch_if_active(
    conn: &Connection,
    manager: &SharedManager,
    project_id: &str,
) -> Result<(), String> {
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .try_dispatch_project(conn, project_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:get-runtime-running")]
pub fn get_runtime_running(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<Vec<crate::types::RuntimeRunningEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .runtime_running(&conn, &project_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:get-runtime-retrying")]
pub fn get_runtime_retrying(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<Vec<crate::types::RuntimeRetryEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .runtime_retrying(&conn, &project_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:get-runtime-recent-finished")]
pub fn get_runtime_recent_finished(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<Vec<crate::types::RuntimeRecentFinishedEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .runtime_recent_finished(&conn, &project_id, DEFAULT_TAIL_LIMIT)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:pause-run")]
pub fn pause_run(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    run_attempt_id: String,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .pause_run(&conn, &run_attempt_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:resume-run")]
pub fn resume_run(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    run_attempt_id: String,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .resume_run(&conn, &run_attempt_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:cancel-run")]
pub fn cancel_run(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    run_attempt_id: String,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .cancel_run(&conn, &run_attempt_id)
        .map_err(|err| err.to_string())
}

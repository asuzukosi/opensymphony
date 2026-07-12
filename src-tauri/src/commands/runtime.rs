use std::sync::{Arc, Mutex};

use tauri::State;

use crate::db::Db;
use crate::orchestrator::Manager;

const DEFAULT_TAIL_LIMIT: i32 = 10;

pub(crate) type SharedManager = Arc<Mutex<Manager>>;

pub(crate) fn ensure_runtime_for_backlog(
    db: &Db,
    manager: &SharedManager,
    project_id: &str,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .ensure_runtime_for_backlog(&conn, project_id)
        .map_err(|err| err.to_string())
}

fn with_manager<R>(
    manager: &State<SharedManager>,
    project_id: &str,
    f: impl FnOnce(&mut Manager) -> Result<R, String>,
) -> Result<R, String> {
    ensure_registered(manager, project_id)?;
    let mut guard = manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?;
    f(&mut guard)
}

#[tauri::command(rename = "opensymphony:get-runtime-running")]
pub fn get_runtime_running(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<Vec<crate::types::RuntimeRunningEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .runtime_running(&conn, &project_id)
            .map_err(|err| err.to_string())
    })
}

#[tauri::command(rename = "opensymphony:get-runtime-retrying")]
pub fn get_runtime_retrying(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<Vec<crate::types::RuntimeRetryEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .runtime_retrying(&conn, &project_id)
            .map_err(|err| err.to_string())
    })
}

#[tauri::command(rename = "opensymphony:get-runtime-recent-finished")]
pub fn get_runtime_recent_finished(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<Vec<crate::types::RuntimeRecentFinishedEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .runtime_recent_finished(&conn, &project_id, DEFAULT_TAIL_LIMIT)
            .map_err(|err| err.to_string())
    })
}

#[tauri::command(rename = "opensymphony:get-runtime-recent-events")]
pub fn get_runtime_recent_events(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<Vec<crate::types::RuntimeAuditEvent>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .runtime_recent_events(&conn, &project_id, DEFAULT_TAIL_LIMIT)
            .map_err(|err| err.to_string())
    })
}

#[tauri::command(rename = "opensymphony:pause-run")]
pub fn pause_run(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
    run_attempt_id: String,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .pause_run(&conn, &run_attempt_id)
            .map_err(|err| err.to_string())
    })
}

#[tauri::command(rename = "opensymphony:resume-run")]
pub fn resume_run(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
    run_attempt_id: String,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .resume_run(&conn, &run_attempt_id)
            .map_err(|err| err.to_string())
    })
}

#[tauri::command(rename = "opensymphony:cancel-run")]
pub fn cancel_run(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
    run_attempt_id: String,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .cancel_run(&conn, &project_id, &run_attempt_id)
            .map_err(|err| err.to_string())
    })
}

fn ensure_registered(
    manager: &State<SharedManager>,
    project_id: &str,
) -> Result<(), String> {
    manager
        .lock()
        .map_err(|_| "orchestrator lock poisoned".to_string())?
        .register_project(project_id);
    Ok(())
}

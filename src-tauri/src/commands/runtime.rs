use std::sync::{Arc, Mutex};

use tauri::State;

use crate::db::Db;
use crate::orchestrator::Manager;
use crate::types::RuntimeSummary;

const DEFAULT_TAIL_LIMIT: i32 = 10;

type SharedManager = Arc<Mutex<Manager>>;

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

// reads

#[tauri::command(rename = "opensymphony:get-runtime-summary")]
pub fn get_runtime_summary(
    _db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<RuntimeSummary, String> {
    with_manager(&manager, &project_id, |guard| {
        guard
            .runtime_summary(&project_id)
            .map_err(|err| err.to_string())
    })
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

#[tauri::command(rename = "opensymphony:get-runtime-candidates")]
pub fn get_runtime_candidates(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<Vec<crate::types::RuntimeCandidateEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .runtime_candidates(&conn, &project_id)
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

// writes

#[tauri::command(rename = "opensymphony:start-runtime")]
pub fn start_runtime(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<RuntimeSummary, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .start_runtime(&conn, &project_id)
            .map_err(|err| err.to_string())
    })
}

#[tauri::command(rename = "opensymphony:stop-runtime")]
pub fn stop_runtime(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<RuntimeSummary, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .stop_runtime(&conn, &project_id)
            .map_err(|err| err.to_string())
    })
}

#[tauri::command(rename = "opensymphony:tick-runtime")]
pub fn tick_runtime(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<RuntimeSummary, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .tick_runtime(&conn, &project_id)
            .map_err(|err| err.to_string())
    })
}

#[tauri::command(rename = "opensymphony:set-runtime-poll-interval")]
pub fn set_runtime_poll_interval(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
    poll_interval_ms: i32,
) -> Result<u32, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .set_runtime_poll_interval(&conn, &project_id, poll_interval_ms)
            .map_err(|err| err.to_string())
    })
}

#[tauri::command(rename = "opensymphony:clear-runtime-poll-interval-override")]
pub fn clear_runtime_poll_interval_override(
    db: State<Arc<Db>>,
    manager: State<SharedManager>,
    project_id: String,
) -> Result<u32, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    with_manager(&manager, &project_id, |guard| {
        guard
            .clear_runtime_poll_interval_override(&conn, &project_id)
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

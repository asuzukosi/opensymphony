use std::fs;

use rusqlite::Connection;
use tauri::State;

use crate::db::error::DbError;
use crate::db::repos::audit::AuditRepo;
use crate::db::repos::issue::IssueRepo;
use crate::db::repos::project::ProjectRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::db::Db;
use crate::types::{
    ProjectPatch, RunAttemptStatus, RuntimeAuditEvent, RuntimeCandidateEntry,
    RuntimeRecentFinishedEntry, RuntimeRetryEntry, RuntimeRunningEntry, RuntimeStatus,
    RuntimeSummary,
};

const DEFAULT_TAIL_LIMIT: i32 = 10;
const DEFAULT_POLL_INTERVAL_MS: i32 = 3000;

// reads

#[tauri::command(rename = "opensymphony:get-runtime-summary")]
pub fn get_runtime_summary(db: State<Db>, project_id: String) -> Result<RuntimeSummary, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    runtime_summary(&conn, &project_id)
}

#[tauri::command(rename = "opensymphony:get-runtime-running")]
pub fn get_runtime_running(
    db: State<Db>,
    project_id: String,
) -> Result<Vec<RuntimeRunningEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let issue_repo = IssueRepo::new(&conn);
    let attempts = RunAttemptRepo::new(&conn)
        .list_running(&project_id)
        .map_err(|err| err.to_string())?;

    let mut entries = Vec::new();
    for attempt in attempts {
        let identifier = issue_repo
            .get(&attempt.issue_id)
            .map_err(|err| err.to_string())?
            .map(|issue| issue.identifier)
            .unwrap_or_default();

        entries.push(RuntimeRunningEntry {
            run_attempt_id: attempt.id,
            issue_id: attempt.issue_id,
            identifier,
            attempt_number: attempt.attempt_number as u32,
            started_at: attempt.started_at,
            session_id: None,
            session_status: None,
            phase: None,
            last_event_summary: None,
            paused: false,
        });
    }
    Ok(entries)
}

#[tauri::command(rename = "opensymphony:get-runtime-retrying")]
pub fn get_runtime_retrying(
    db: State<Db>,
    project_id: String,
) -> Result<Vec<RuntimeRetryEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    list_retries_for_project(&conn, &project_id).map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:get-runtime-candidates")]
pub fn get_runtime_candidates(
    db: State<Db>,
    project_id: String,
) -> Result<Vec<RuntimeCandidateEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let cards = IssueRepo::new(&conn)
        .list_candidates(&project_id)
        .map_err(|err| err.to_string())?;

    Ok(cards
        .into_iter()
        .map(|card| RuntimeCandidateEntry {
            issue_id: card.issue_id,
            identifier: card.identifier,
            title: card.title,
            priority: card.priority,
            state_category: "active".into(),
        })
        .collect())
}

#[tauri::command(rename = "opensymphony:get-runtime-recent-finished")]
pub fn get_runtime_recent_finished(
    db: State<Db>,
    project_id: String,
) -> Result<Vec<RuntimeRecentFinishedEntry>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let issue_repo = IssueRepo::new(&conn);
    let attempts = RunAttemptRepo::new(&conn)
        .list_recent_finished(&project_id, DEFAULT_TAIL_LIMIT)
        .map_err(|err| err.to_string())?;

    let mut entries = Vec::new();
    for attempt in attempts {
        let identifier = issue_repo
            .get(&attempt.issue_id)
            .map_err(|err| err.to_string())?
            .map(|issue| issue.identifier)
            .unwrap_or_default();

        entries.push(RuntimeRecentFinishedEntry {
            run_attempt_id: attempt.id,
            issue_id: attempt.issue_id,
            identifier,
            attempt_number: attempt.attempt_number as u32,
            status: parse_run_attempt_status(&attempt.status),
            finished_at: attempt.finished_at.unwrap_or_default(),
            error_message: attempt.error_message,
            review_status: None,
        });
    }
    Ok(entries)
}

#[tauri::command(rename = "opensymphony:get-runtime-recent-events")]
pub fn get_runtime_recent_events(
    db: State<Db>,
    project_id: String,
) -> Result<Vec<RuntimeAuditEvent>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let events = AuditRepo::new(&conn)
        .list_recent(&project_id, DEFAULT_TAIL_LIMIT)
        .map_err(|err| err.to_string())?;

    Ok(events
        .into_iter()
        .map(|event| RuntimeAuditEvent {
            action: event.action,
            issue_id: event.issue_id,
            created_at: event.created_at,
        })
        .collect())
}

// writes

#[tauri::command(rename = "opensymphony:start-runtime")]
pub fn start_runtime(db: State<Db>, project_id: String) -> Result<RuntimeSummary, String> {
    set_orchestrator_status(db, &project_id, "running")
}

#[tauri::command(rename = "opensymphony:stop-runtime")]
pub fn stop_runtime(db: State<Db>, project_id: String) -> Result<RuntimeSummary, String> {
    set_orchestrator_status(db, &project_id, "stopped")
}

#[tauri::command(rename = "opensymphony:tick-runtime")]
pub fn tick_runtime(db: State<Db>, project_id: String) -> Result<RuntimeSummary, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    runtime_summary(&conn, &project_id)
}

#[tauri::command(rename = "opensymphony:set-runtime-poll-interval")]
pub fn set_runtime_poll_interval(
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

#[tauri::command(rename = "opensymphony:clear-runtime-poll-interval-override")]
pub fn clear_runtime_poll_interval_override(
    db: State<Db>,
    project_id: String,
) -> Result<u32, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let project = ProjectRepo::new(&conn)
        .get(&project_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| DbError::NotFound(format!("project {project_id}")).to_string())?;

    let poll_interval_ms = project
        .workflow_file_path
        .as_deref()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|content| parse_workflow_poll_interval(&content))
        .unwrap_or(DEFAULT_POLL_INTERVAL_MS);

    let updated = ProjectRepo::new(&conn)
        .update(
            &project_id,
            &ProjectPatch {
                poll_interval_ms: Some(poll_interval_ms),
                ..ProjectPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;
    Ok(updated.poll_interval_ms as u32)
}

#[tauri::command(rename = "opensymphony:pause-run")]
pub fn pause_run(
    db: State<Db>,
    project_id: String,
    run_attempt_id: String,
) -> Result<(), String> {
    let _ = (db, project_id, run_attempt_id);
    Ok(())
}

#[tauri::command(rename = "opensymphony:resume-run")]
pub fn resume_run(
    db: State<Db>,
    project_id: String,
    run_attempt_id: String,
) -> Result<(), String> {
    let _ = (db, project_id, run_attempt_id);
    Ok(())
}

#[tauri::command(rename = "opensymphony:cancel-run")]
pub fn cancel_run(
    db: State<Db>,
    project_id: String,
    run_attempt_id: String,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let attempt = RunAttemptRepo::new(&conn)
        .list_running(&project_id)
        .map_err(|err| err.to_string())?
        .into_iter()
        .find(|entry| entry.id == run_attempt_id)
        .ok_or_else(|| DbError::NotFound(format!("run attempt {run_attempt_id}")).to_string())?;

    RunAttemptRepo::new(&conn)
        .finish(&attempt.id, "cancelled", None)
        .map_err(|err| err.to_string())?;
    Ok(())
}

fn runtime_summary(conn: &Connection, project_id: &str) -> Result<RuntimeSummary, String> {
    let project = ProjectRepo::new(conn)
        .get(project_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| DbError::NotFound(format!("project {project_id}")).to_string())?;

    Ok(RuntimeSummary {
        status: parse_runtime_status(&project.orchestrator_status),
        poll_interval_ms: project.poll_interval_ms as u32,
        started_at: None,
        next_tick_at: None,
        tick_count: 0,
        last_tick_at: None,
        last_dispatched_count: 0,
        last_action: None,
        last_error: None,
        validation_error: None,
    })
}

fn set_orchestrator_status(
    db: State<Db>,
    project_id: &str,
    status: &str,
) -> Result<RuntimeSummary, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    ProjectRepo::new(&conn)
        .update(
            project_id,
            &ProjectPatch {
                orchestrator_status: Some(status.into()),
                ..ProjectPatch::default()
            },
        )
        .map_err(|err| err.to_string())?;
    runtime_summary(&conn, project_id)
}

fn parse_workflow_poll_interval(content: &str) -> Option<i32> {
    let trimmed = content.trim_start();
    let rest = trimmed.strip_prefix("---")?;
    let rest = rest.trim_start_matches('\n');
    let (front_matter, _) = rest.split_once("\n---")?;

    for line in front_matter.lines() {
        let line = line.trim();
        if let Some(value) = line.strip_prefix("poll_interval_ms:") {
            return value.trim().parse().ok();
        }
    }
    None
}

fn list_retries_for_project(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<RuntimeRetryEntry>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT q.issue_id, i.identifier, q.attempt_number, q.due_at, q.error_message
         FROM retry_queue q
         JOIN issues i ON i.id = q.issue_id
         WHERE i.project_id = ?1
         ORDER BY q.due_at ASC",
    )?;
    let mut rows = stmt.query([project_id])?;
    let mut entries = Vec::new();
    while let Some(row) = rows.next()? {
        entries.push(RuntimeRetryEntry {
            issue_id: row.get(0)?,
            identifier: row.get(1)?,
            attempt_number: row.get::<_, i32>(2)? as u32,
            due_at: row.get(3)?,
            error_message: row.get(4)?,
        });
    }
    Ok(entries)
}

fn parse_runtime_status(value: &str) -> RuntimeStatus {
    match value {
        "running" => RuntimeStatus::Running,
        "stopped" => RuntimeStatus::Stopped,
        _ => RuntimeStatus::Idle,
    }
}

fn parse_run_attempt_status(value: &str) -> RunAttemptStatus {
    match value {
        "succeeded" => RunAttemptStatus::Succeeded,
        "cancelled" => RunAttemptStatus::Cancelled,
        _ => RunAttemptStatus::Failed,
    }
}

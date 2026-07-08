//! thin audit helper for orchestrator runtime lifecycle events.

use rusqlite::Connection;

use crate::db::error::DbResult;
use crate::db::repos::audit::AuditRepo;

pub mod action {
    pub const RUNTIME_STARTED: &str = "runtime_started";
    pub const RUNTIME_STOPPED: &str = "runtime_stopped";
    pub const TICK_COMPLETED: &str = "tick_completed";
    pub const WORKFLOW_RELOADED: &str = "workflow_reloaded";
    pub const RESTART_RECOVERY_APPLIED: &str = "restart_recovery_applied";
    pub const WORKSPACE_CLEANUP_STARTUP: &str = "workspace_cleanup_startup";
    pub const ATTEMPT_DISPATCHED: &str = "attempt_dispatched";
    pub const ATTEMPT_SUCCEEDED: &str = "attempt_succeeded";
    pub const ATTEMPT_FAILED: &str = "attempt_failed";
    pub const ATTEMPT_CANCELLED: &str = "attempt_cancelled";
    pub const PERMISSION_RESOLVED: &str = "permission_resolved";
}

pub(crate) fn log(
    conn: &Connection,
    project_id: &str,
    action: &str,
    issue_id: Option<&str>,
) -> DbResult<()> {
    AuditRepo::new(conn).append(project_id, action, issue_id)?;
    Ok(())
}


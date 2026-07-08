use std::sync::Arc;
use tauri::State;

use crate::acp::AcpState;
use crate::db::repos::issue::IssueRepo;
use crate::db::repos::pending_permission::PendingPermissionRepo;
use crate::db::Db;
use crate::orchestrator::audit;
use crate::types::{PendingPermission, PermissionDecision};

#[tauri::command(rename = "opensymphony:list-issue-pending-permissions")]
pub fn list_issue_pending_permissions(
    db: State<Arc<Db>>,
    issue_id: String,
) -> Result<Vec<PendingPermission>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    PendingPermissionRepo::new(&conn)
        .list_by_issue(&issue_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:resolve-session-permission")]
pub fn resolve_session_permission(
    acp: State<AcpState>,
    db: State<Arc<Db>>,
    permission_id: String,
    decision: PermissionDecision,
) -> Result<(), String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let permission = PendingPermissionRepo::new(&conn)
        .get(&permission_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| format!("pending permission {permission_id} not found"))?;
    let issue = IssueRepo::new(&conn)
        .get(&permission.issue_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| format!("issue {} not found", permission.issue_id))?;

    if !acp.permission_gate.resolve(&permission_id, decision) {
        return Err(format!("pending permission {permission_id} not found"));
    }

    PendingPermissionRepo::new(&conn)
        .resolve(&permission_id)
        .map_err(|err| err.to_string())?;
    audit::log(
        &conn,
        &issue.project_id,
        audit::action::PERMISSION_RESOLVED,
        Some(&permission.issue_id),
    )
    .map_err(|err| err.to_string())
}

use std::sync::Arc;
use tauri::State;

use crate::acp::AcpState;
use crate::db::repos::pending_permission::PendingPermissionRepo;
use crate::db::Db;
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
    // unblock the waiting agent handler first, then remove the persisted row.
    if !acp.permission_gate.resolve(&permission_id, decision) {
        return Err(format!("pending permission {permission_id} not found"));
    }

    let conn = db.conn().map_err(|err| err.to_string())?;
    PendingPermissionRepo::new(&conn)
        .resolve(&permission_id)
        .map_err(|err| err.to_string())
}

use tauri::State;

use crate::db::repos::pending_permission::PendingPermissionRepo;
use crate::db::Db;
use crate::types::{PendingPermission, PermissionDecision};

// reads

#[tauri::command(rename = "opensymphony:list-issue-pending-permissions")]
pub fn list_issue_pending_permissions(
    db: State<Db>,
    issue_id: String,
) -> Result<Vec<PendingPermission>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    PendingPermissionRepo::new(&conn)
        .list_by_issue(&issue_id)
        .map_err(|err| err.to_string())
}

// writes

#[tauri::command(rename = "opensymphony:resolve-session-permission")]
pub fn resolve_session_permission(
    db: State<Db>,
    permission_id: String,
    decision: PermissionDecision,
) -> Result<(), String> {
    let _ = decision;
    let conn = db.conn().map_err(|err| err.to_string())?;
    PendingPermissionRepo::new(&conn)
        .resolve(&permission_id)
        .map_err(|err| err.to_string())
}

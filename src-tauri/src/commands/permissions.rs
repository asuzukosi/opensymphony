use crate::stubs::permissions as permissions_stubs;
use crate::types::{PendingPermission, ResolvePermissionRequest};

#[tauri::command(rename = "opensymphony:get-pending-permissions")]
pub fn get_pending_permissions() -> Vec<PendingPermission> {
    permissions_stubs::sample_pending_permissions()
}

#[tauri::command(rename = "opensymphony:resolve-permission")]
pub fn resolve_permission(request: ResolvePermissionRequest) -> Result<(), String> {
    let _ = request;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::PermissionDecision;

    #[test]
    fn returns_empty_pending_permissions() {
        assert!(get_pending_permissions().is_empty());
    }

    #[test]
    fn resolve_permission_is_no_op() {
        let result = resolve_permission(ResolvePermissionRequest {
            id: "perm-1".into(),
            decision: PermissionDecision::Approve,
        });

        assert!(result.is_ok());
    }
}

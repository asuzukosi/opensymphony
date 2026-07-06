use crate::stubs::permissions as permissions_stubs;
use crate::types::{PendingPermission, ResolvePermissionRequest};

#[tauri::command]
pub fn get_pending_permissions() -> Vec<PendingPermission>{
    permissions_stubs::sample_pending_permissions()
}

#[tauri::command]
pub fn resolve_permission(request: ResolvePermissionRequest) -> Result<(), String>{
    let _ = request;
    Ok(())
}


// #[cfg(test)]
// mod tests {
//     use super::*;

//     #[test]


// }
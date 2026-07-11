use crate::db::error::{DbError, DbResult};
use crate::types::PermissionMode;

pub fn as_str(mode: PermissionMode) -> &'static str {
    match mode {
        PermissionMode::AutoApprove => "autoApprove",
        PermissionMode::RequiresApproval => "requiresApproval",
    }
}

pub fn parse(value: &str) -> DbResult<PermissionMode> {
    parse_optional(value).ok_or_else(|| {
        DbError::Internal(format!("unknown permission mode: {value}"))
    })
}

pub fn parse_optional(value: &str) -> Option<PermissionMode> {
    match value {
        "autoApprove" | "auto_approve" => Some(PermissionMode::AutoApprove),
        "requiresApproval" | "requires_approval" => Some(PermissionMode::RequiresApproval),
        _ => None,
    }
}

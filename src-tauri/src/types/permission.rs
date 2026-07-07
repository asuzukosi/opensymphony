use serde::{Deserialize, Serialize};

/// pending permission row — shared by repos and ipc.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingPermission {
    pub id: String,
    pub session_id: String,
    pub issue_id: String,
    pub summary: String,
    pub payload: serde_json::Value,
    pub created_at: String,
}

impl PendingPermission {
    pub fn payload_json(&self) -> String {
        self.payload.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PermissionDecision {
    Approve,
    Deny,
}

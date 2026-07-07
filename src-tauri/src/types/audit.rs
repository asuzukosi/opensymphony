use serde::{Deserialize, Serialize};

/// audit event row from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub id: String,
    pub project_id: String,
    pub issue_id: Option<String>,
    pub action: String,
    pub created_at: String,
}

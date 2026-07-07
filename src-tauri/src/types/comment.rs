use serde::{Deserialize, Serialize};

/// issue comment row — `author` is the ipc field name for `author_id`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueComment {
    pub id: String,
    pub issue_id: String,
    pub body: String,
    #[serde(rename = "author")]
    pub author_id: Option<String>,
    pub created_at: String,
}

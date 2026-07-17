use serde::{Deserialize, Serialize};

/// task comment row — `author` is the ipc field name for `author_id`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskComment {
    pub id: String,
    pub task_id: String,
    pub body: String,
    #[serde(rename = "author")]
    pub author_id: Option<String>,
    pub created_at: String,
}

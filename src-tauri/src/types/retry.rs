use serde::{Deserialize, Serialize};

/// retry queue row from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryQueueEntry {
    pub task_id: String,
    pub attempt_number: i32,
    pub due_at: String,
    pub error_message: Option<String>,
}

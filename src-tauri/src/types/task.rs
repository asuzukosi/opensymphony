use serde::{Deserialize, Serialize};

use super::board::BoardColumnId;
use super::session::RunAttempt;

/// full task row from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub board_column: BoardColumnId,
    pub executor: Option<String>,
    pub auto_approve_permissions: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Default)]
pub struct TaskPatch {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<i32>,
}

/// slim task slice for the task detail sheet.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskHeader {
    pub task_id: String,
    pub project_id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub board_column: BoardColumnId,
    pub executor: Option<String>,
    pub auto_approve_permissions: bool,
    pub tags: Vec<String>,
    pub files: Vec<TaskFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskFile {
    pub file_id: String,
    pub task_id: String,
    pub file_name: String,
    pub mime_type: Option<String>,
    pub size_bytes: i64,
    pub created_at: String,
}

impl From<Task> for TaskHeader {
    fn from(task: Task) -> Self {
        Self {
            task_id: task.id,
            project_id: task.project_id,
            identifier: task.identifier,
            title: task.title,
            description: task.description,
            priority: task.priority,
            board_column: task.board_column,
            executor: task.executor,
            auto_approve_permissions: task.auto_approve_permissions,
            tags: Vec::new(),
            files: Vec::new(),
        }
    }
}

/// one orchestrator run attempt for a task detail view.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDetailRunAttempt {
    pub run_attempt_id: String,
    pub attempt_number: u32,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error_message: Option<String>,
}

impl From<RunAttempt> for TaskDetailRunAttempt {
    fn from(attempt: RunAttempt) -> Self {
        Self {
            run_attempt_id: attempt.id,
            attempt_number: attempt.attempt_number as u32,
            status: attempt.status,
            started_at: attempt.started_at,
            finished_at: attempt.finished_at,
            error_message: attempt.error_message,
        }
    }
}

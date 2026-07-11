use serde::{Deserialize, Serialize};

use super::board::BoardColumnId;
use super::session::RunAttempt;

/// full issue row from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
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
pub struct IssuePatch {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<i32>,
}

/// slim issue slice for the issue detail header.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueHeader {
    pub issue_id: String,
    pub project_id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub board_column: BoardColumnId,
    pub executor: Option<String>,
    pub auto_approve_permissions: bool,
    pub tags: Vec<String>,
    pub files: Vec<IssueFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueFile {
    pub file_id: String,
    pub issue_id: String,
    pub file_name: String,
    pub mime_type: Option<String>,
    pub size_bytes: i64,
    pub created_at: String,
}

impl From<Issue> for IssueHeader {
    fn from(issue: Issue) -> Self {
        Self {
            issue_id: issue.id,
            project_id: issue.project_id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            priority: issue.priority,
            board_column: issue.board_column,
            executor: issue.executor,
            auto_approve_permissions: issue.auto_approve_permissions,
            tags: Vec::new(),
            files: Vec::new(),
        }
    }
}

/// one orchestrator run attempt for an issue detail view.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueDetailRunAttempt {
    pub run_attempt_id: String,
    pub attempt_number: u32,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error_message: Option<String>,
}

impl From<RunAttempt> for IssueDetailRunAttempt {
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

use serde::{Deserialize, Serialize};

/// payload from the create project form (ipc).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
    pub workspace_root: String,
    pub use_per_issue_workspaces: bool,
    pub use_worktrees: bool,
    pub prompt_template: String,
    pub platforms: Vec<String>,
    pub poll_interval_ms: i32,
    pub max_concurrency: i32,
    pub retry_max_attempts: i32,
    pub retry_backoff_ms: i32,
}

/// full project row from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub workspace_root: String,
    pub prompt_template: String,
    pub poll_interval_ms: i32,
    pub max_concurrency: i32,
    pub retry_max_attempts: i32,
    pub retry_backoff_ms: i32,
    pub use_per_issue_workspaces: bool,
    pub use_worktrees: bool,
    pub orchestrator_status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub orchestrator_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryPolicy {
    pub max_attempts: i32,
    pub backoff_ms: i32,
}

#[derive(Debug, Clone)]
pub struct CreateProjectParams {
    pub name: String,
    pub workspace_root: String,
    pub prompt_template: String,
    pub use_per_issue_workspaces: bool,
    pub use_worktrees: bool,
    pub poll_interval_ms: i32,
    pub max_concurrency: i32,
    pub retry_max_attempts: i32,
    pub retry_backoff_ms: i32,
    pub platforms: Vec<String>,
}

#[derive(Default)]
pub struct ProjectPatch {
    pub name: Option<String>,
    pub workspace_root: Option<String>,
    pub prompt_template: Option<String>,
    pub poll_interval_ms: Option<i32>,
    pub max_concurrency: Option<i32>,
    pub retry_max_attempts: Option<i32>,
    pub retry_backoff_ms: Option<i32>,
    pub use_per_issue_workspaces: Option<bool>,
    pub use_worktrees: Option<bool>,
    pub orchestrator_status: Option<String>,
}

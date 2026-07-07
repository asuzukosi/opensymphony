use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionMode {
    AutoApprove,
    RequiresApproval,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PermissionModeSource {
    Workflow,
    Override,
}

/// full project row from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub workspace_root: Option<String>,
    pub workflow_source: Option<String>,
    pub workflow_file_path: Option<String>,
    pub workflow_file_mtime: Option<String>,
    pub workflow_version: Option<String>,
    pub workflow_last_loaded_at: Option<String>,
    pub max_concurrency: i32,
    pub retry_max_attempts: i32,
    pub retry_backoff_ms: i32,
    pub prompt_template: String,
    pub poll_interval_ms: i32,
    pub permission_mode: PermissionMode,
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

#[derive(Default)]
pub struct ProjectPatch {
    pub name: Option<String>,
    pub workflow_source: Option<String>,
    pub workflow_file_path: Option<String>,
    pub workflow_file_mtime: Option<String>,
    pub workflow_version: Option<String>,
    pub prompt_template: Option<String>,
    pub poll_interval_ms: Option<i32>,
    pub max_concurrency: Option<i32>,
    pub retry_max_attempts: Option<i32>,
    pub retry_backoff_ms: Option<i32>,
    pub permission_mode: Option<PermissionMode>,
    pub orchestrator_status: Option<String>,
}

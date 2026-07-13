use serde::{Deserialize, Serialize};

/// orchestrator lifecycle: idle when no work; running while dispatching or waiting on retries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeStatus {
    Idle,
    Running,
}

/// high-level phase of an in-flight acp session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeSessionPhase {
    Spawning,
    Initializing,
    Prompting,
    Streaming,
    Paused,
    Terminal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunAttemptStatus {
    Succeeded,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReviewStatus {
    Approved,
    PendingReview,
}

/// one actively running agent attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeRunningEntry {
    pub run_attempt_id: String,
    pub issue_id: String,
    pub title: String,
    pub description: Option<String>,
    pub executor: Option<String>,
    pub attempt_number: u32,
    pub started_at: String,
    pub phase: Option<RuntimeSessionPhase>,
    pub paused: bool,
}

/// issue waiting for a future retry after backoff.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeRetryEntry {
    pub issue_id: String,
    pub title: String,
    pub description: Option<String>,
    pub executor: Option<String>,
    pub attempt_number: u32,
    pub due_at: String,
    pub error_message: Option<String>,
}

/// recently completed run for agents/dashboard activity columns.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeRecentFinishedEntry {
    pub run_attempt_id: String,
    pub issue_id: String,
    pub title: String,
    pub description: Option<String>,
    pub executor: Option<String>,
    pub attempt_number: u32,
    pub status: RunAttemptStatus,
    pub finished_at: String,
    pub error_message: Option<String>,
    pub review_status: Option<ReviewStatus>,
}

/// tauri runtime event payload scoped to a project.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProjectEventPayload {
    pub project_id: String,
}

/// tauri runtime event payload for orchestrator status changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeOrchestratorStatusPayload {
    pub project_id: String,
    pub status: String,
}

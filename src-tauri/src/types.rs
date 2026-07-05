//! ipc payload types for tauri commands and the next.js frontend.
//! runtime snapshot is intentionally slimmer than reference ipc.ts:
//! workflow config lives on get_settings; list lengths replace duplicate count structs.

use serde::{Deserialize, Serialize};

/// orchestrator lifecycle: not ticking, actively ticking, or explicitly stopped.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeStatus {
    Idle,
    Running,
    Stopped,
}

/// where poll interval or permission mode override came from (used by get_settings in t04f).
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PollIntervalSource {
    Workflow,
    Override,
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
#[serde(rename_all = "snake_case")]
pub enum ReviewStatus {
    Approved,
    PendingReview,
}

/// one audit log line for the dashboard event tail.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeAuditEvent {
    pub action: String,
    pub issue_id: Option<String>,
    pub created_at: String,
}

/// one actively running agent attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeRunningEntry {
    pub run_attempt_id: String,
    pub issue_id: String,
    pub identifier: String,
    pub attempt_number: u32,
    pub started_at: String,
    pub session_id: Option<String>,
    pub session_status: Option<String>,
    pub phase: Option<RuntimeSessionPhase>,
    pub last_event_summary: Option<String>,
    pub paused: bool,
}

/// issue waiting for a future retry after backoff.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeRetryEntry {
    pub issue_id: String,
    pub identifier: String,
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
    pub identifier: String,
    pub attempt_number: u32,
    pub status: RunAttemptStatus,
    pub finished_at: String,
    pub error_message: Option<String>,
    pub review_status: Option<ReviewStatus>,
}

/// issue eligible for dispatch on the next orchestrator tick.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCandidateEntry {
    pub issue_id: String,
    pub identifier: String,
    pub title: String,
    pub priority: Option<i32>,
    pub state_category: String,
}

/// orchestrator ops snapshot from get_runtime_state and control_runtime.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStateSnapshot {
    pub status: RuntimeStatus,
    pub started_at: Option<String>,
    pub poll_interval_ms: u32,
    pub next_tick_at: Option<String>,
    pub tick_count: u32,
    pub last_tick_at: Option<String>,
    pub last_dispatched_count: u32,
    pub last_action: Option<String>,
    pub last_error: Option<String>,
    pub validation_error: Option<String>,
    pub running: Vec<RuntimeRunningEntry>,
    pub retrying: Vec<RuntimeRetryEntry>,
    pub recent_finished: Vec<RuntimeRecentFinishedEntry>,
    pub candidates: Vec<RuntimeCandidateEntry>,
    pub recent_events: Vec<RuntimeAuditEvent>,
}

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

/// workflow column grouping used by orchestrator selection and issue workflow.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkflowStateCategory {
    Active,
    Terminal,
    Backlog,
    Other,
}

/// fixed kanban column ids — board layout is app-defined, not derived from workflow states.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BoardColumnId {
    Backlog,
    InProgress,
    Review,
    Done,
}

impl BoardColumnId {
    pub const ALL: [Self; 4] = [Self::Backlog, Self::InProgress, Self::Review, Self::Done];
}

/// issue card on the project board.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBoardIssue {
    pub issue_id: String,
    pub identifier: String,
    pub title: String,
    pub priority: Option<i32>,
}

/// issues in one fixed board column.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardColumn {
    pub issues: Vec<ProjectBoardIssue>,
}

impl Default for BoardColumn {
    fn default() -> Self {
        Self {
            issues: Vec::new(),
        }
    }
}

/// full board returned by get_project_board — always exposes the same four columns.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBoard {
    pub backlog: BoardColumn,
    pub in_progress: BoardColumn,
    pub review: BoardColumn,
    pub done: BoardColumn,
}

impl Default for ProjectBoard {
    fn default() -> Self {
        Self {
            backlog: BoardColumn::default(),
            in_progress: BoardColumn::default(),
            review: BoardColumn::default(),
            done: BoardColumn::default(),
        }
    }
}

impl ProjectBoard {
    pub fn column(&self, id: BoardColumnId) -> &BoardColumn {
        match id {
            BoardColumnId::Backlog => &self.backlog,
            BoardColumnId::InProgress => &self.in_progress,
            BoardColumnId::Review => &self.review,
            BoardColumnId::Done => &self.done,
        }
    }
}

/// comment on an issue detail view.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueDetailComment {
    pub id: String,
    pub body: String,
    pub author: Option<String>,
    pub created_at: String,
}

/// acp session event kind for issue attempt timelines.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionEventKind {
    Prompt,
    StreamChunk,
    ToolCall,
    PermissionRequest,
    PermissionResolve,
    SessionUpdate,
    Error,
}

/// one event in an agent session timeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEvent {
    pub id: String,
    pub kind: SessionEventKind,
    pub payload: serde_json::Value,
    pub created_at: String,
}

/// agent session nested under a run attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueDetailSession {
    pub session_id: String,
    pub session_ref: Option<String>,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub events: Vec<SessionEvent>,
}

/// one orchestrator run attempt for an issue.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueDetailRunAttempt {
    pub run_attempt_id: String,
    pub attempt_number: u32,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error_message: Option<String>,
    pub sessions: Vec<IssueDetailSession>,
}

/// full issue payload returned by get_issue.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueDetail {
    pub issue_id: String,
    pub project_id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub workflow_state_id: String,
    pub workflow_state_name: String,
    pub comments: Vec<IssueDetailComment>,
    pub attempts: Vec<IssueDetailRunAttempt>,
}

/// issue mutation payload for mutate_issue.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "lowercase")]
pub enum MutateIssueRequest {
    #[serde(rename_all = "camelCase")]
    Transition {
        issue_id: String,
        target_state_id: String,
        actor: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Comment {
        issue_id: String,
        body: String,
        author: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Create {
        project_id: String,
        title: String,
        description: Option<String>,
        priority: Option<i32>,
        workflow_state_id: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Update {
        issue_id: String,
        title: Option<String>,
        description: Option<String>,
        priority: Option<i32>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PermissionMode {
    AutoApprove,
    RequiresApproval,
}

// orchestrator mutation payload
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum ControlRuntimeRequest {
    #[serde(rename_all = "camelCase")]
    Start {},
    Stop  {},
    Tick {},
    SetPollInterval {
        poll_interval_ms: i32,
    },
    ClearPollIntervalOverride {},
    SetPermissionMode {
        permission_mode: PermissionMode,
    },
    ClearPermissionModeOverride {},
    PauseRun {
        run_attempt_id: String,
    },
    ResumeRun {
        run_attempt_id: String,
    },
    CancelRun {
        run_attempt_id: String
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PermissionModeSource {
    Workflow,
    Override,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub struct SettingsProjectMeta {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub agents: Vec<String>
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AgentCommunication {
    Acp, 
    Terminal
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct SettingsACPConfig {
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub communication: AgentCommunication,
    pub acp: Option<SettingsACPConfig>
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    pub status: RuntimeStatus,
    pub workflow_path: Option<String>,
    pub workflow_version: Option<String>,
    pub prompt_template: String,
    pub poll_interval_ms: i32,
    pub poll_interval_source: PollIntervalSource,
    pub permission_mode: PermissionMode,
    pub permission_mode_source: PermissionModeSource,
    pub projects: Vec<SettingsProjectMeta>,
    pub agents: Vec<Agent>,
    pub started_at: Option<String>,
    pub next_tick_at: Option<String>,
    pub tick_count: i32,
    pub last_tick_at: Option<String>,
    pub last_action: Option<String>,
    pub last_error: Option<String>,

}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingPermission {
    pub id: String,
    pub session_id: String,
    pub issue_id: String,
    pub summary: String,
    pub payload: serde_json::Value,
    pub created_at: String
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PermissionDecision {
    Approve, 
    Deny
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvePermissionRequest {
    pub id: String,
    pub decision: PermissionDecision,
}
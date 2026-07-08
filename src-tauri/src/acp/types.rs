//! acp session types and adapter contract.

use std::sync::Arc;

use super::PauseGate;
use crate::types::RuntimeSessionPhase;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeSessionStatus {
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

impl RuntimeSessionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }
}

#[derive(Clone)]
pub struct StartRuntimeSessionInput {
    pub agent_session_id: String,
    pub run_attempt_id: String,
    pub issue_id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub prompt_template: String,
    pub attempt_number: u32,
    pub started_at: String,
    pub workspace_path: String,
    pub acp_command: Option<String>,
    pub agent_name: Option<String>,
    pub pause_gate: Arc<dyn PauseGate>,
}

#[derive(Debug, Clone)]
pub struct RuntimeSessionRecord {
    pub session_id: String,
    pub run_attempt_id: String,
    pub issue_id: String,
    pub attempt_number: u32,
    pub session_ref: Option<String>,
    pub status: RuntimeSessionStatus,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error_message: Option<String>,
    pub agent_name: Option<String>,
    pub paused: bool,
}

/// acp runtime adapter. pause/resume live on orchestrator-owned PauseGate, not here.
pub trait AcpAdapter: Send + Sync {
    fn start_session(&self, input: StartRuntimeSessionInput) -> RuntimeSessionRecord;

    fn poll_sessions(&self, now_iso: &str, session_ids: &[String]) -> Vec<RuntimeSessionRecord>;

    fn cancel_session(
        &self,
        session_id: &str,
        now_iso: &str,
        reason: &str,
    ) -> Option<RuntimeSessionRecord>;

    fn get_session_phase(&self, session_id: &str) -> Option<RuntimeSessionPhase>;

    fn get_current_activity(&self, session_id: &str) -> Option<String>;

    fn get_last_agent_message(&self, session_id: &str) -> Option<String>;

    fn is_session_paused(&self, session_id: &str) -> bool;
}

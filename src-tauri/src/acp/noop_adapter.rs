//! noop acp adapter for orchestrator tests before real agent dispatch.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::types::RuntimeSessionPhase;

use super::PauseGate;
use super::types::{
    AcpAdapter, RuntimeSessionRecord, RuntimeSessionStatus, StartRuntimeSessionInput,
};

struct StoredSession {
    record: RuntimeSessionRecord,
    pause_gate: Arc<dyn PauseGate>,
}

pub struct NoopAcpAdapter {
    sessions: Mutex<HashMap<String, StoredSession>>,
}

impl NoopAcpAdapter {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn with_session<R>(
        &self,
        session_id: &str,
        f: impl FnOnce(&StoredSession) -> R,
    ) -> Option<R> {
        let guard = self.sessions.lock().ok()?;
        guard.get(session_id).map(f)
    }

    fn with_session_mut<R>(
        &self,
        session_id: &str,
        f: impl FnOnce(&mut StoredSession) -> R,
    ) -> Option<R> {
        let mut guard = self.sessions.lock().ok()?;
        guard.get_mut(session_id).map(f)
    }
}

impl Default for NoopAcpAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl AcpAdapter for NoopAcpAdapter {
    fn start_session(&self, input: StartRuntimeSessionInput) -> RuntimeSessionRecord {
        let session_id = input.agent_session_id.clone();
        let record = RuntimeSessionRecord {
            session_id: session_id.clone(),
            run_attempt_id: input.run_attempt_id,
            issue_id: input.issue_id,
            attempt_number: input.attempt_number,
            session_ref: None,
            status: RuntimeSessionStatus::Running,
            started_at: input.started_at,
            finished_at: None,
            error_message: None,
            agent_name: input.agent_name.clone(),
            paused: input.pause_gate.is_paused(),
        };

        if let Ok(mut guard) = self.sessions.lock() {
            guard.insert(
                session_id,
                StoredSession {
                    record: record.clone(),
                    pause_gate: input.pause_gate,
                },
            );
        }

        record
    }

    fn poll_sessions(&self, now_iso: &str, session_ids: &[String]) -> Vec<RuntimeSessionRecord> {
        let mut out = Vec::new();

        for session_id in session_ids {
            let Some(record) = self.with_session_mut(session_id, |stored| {
                if stored.record.status == RuntimeSessionStatus::Running {
                    stored.record.status = RuntimeSessionStatus::Succeeded;
                    stored.record.finished_at = Some(now_iso.to_string());
                }
                stored.record.clone()
            }) else {
                continue;
            };
            out.push(record);
        }

        out
    }

    fn cancel_session(
        &self,
        session_id: &str,
        now_iso: &str,
        reason: &str,
    ) -> Option<RuntimeSessionRecord> {
        self.with_session_mut(session_id, |stored| {
            stored.record.status = RuntimeSessionStatus::Cancelled;
            stored.record.finished_at = Some(now_iso.to_string());
            stored.record.error_message = Some(reason.into());
            stored.record.clone()
        })
    }

    fn get_session_phase(&self, session_id: &str) -> Option<RuntimeSessionPhase> {
        self.with_session(session_id, |stored| match stored.record.status {
            RuntimeSessionStatus::Running => RuntimeSessionPhase::Prompting,
            _ => RuntimeSessionPhase::Terminal,
        })
    }

    fn get_current_activity(&self, session_id: &str) -> Option<String> {
        self.with_session(session_id, |stored| {
            (stored.record.status == RuntimeSessionStatus::Running).then(|| "noop prompt".into())
        })
        .flatten()
    }

    fn get_last_agent_message(&self, session_id: &str) -> Option<String> {
        self.with_session(session_id, |stored| {
            (stored.record.status == RuntimeSessionStatus::Succeeded)
                .then(|| format!("noop completed {}", stored.record.issue_id))
        })
        .flatten()
    }

    fn is_session_paused(&self, session_id: &str) -> bool {
        self.with_session(session_id, |stored| stored.pause_gate.is_paused())
            .unwrap_or(false)
    }
}


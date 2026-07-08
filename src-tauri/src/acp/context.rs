//! in-memory session state and lifecycle helpers for the acp adapter.

use std::sync::{Arc, Mutex};

use agent_client_protocol::schema::{SessionNotification, StopReason};
use serde_json::{json, Value};
use tokio::process::Child;

use crate::db::repos::agent_session::AgentSessionRepo;
use crate::db::repos::session_event::SessionEventRepo;
use crate::db::Db;
use crate::runtime::PauseGate;
use crate::types::{RuntimeSessionPhase, SessionEventKind};

use super::recorder::Recorder;
use super::types::{RuntimeSessionRecord, RuntimeSessionStatus};

pub(crate) struct StoredSession {
    pub session_id: String,
    pub run_attempt_id: String,
    pub issue_id: String,
    pub attempt_number: u32,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub status: RuntimeSessionStatus,
    pub error_message: Option<String>,
    pub phase: RuntimeSessionPhase,
    pub agent_session_ref: Option<String>,
    pub cancelled: bool,
    pub pause_gate: Arc<dyn PauseGate>,
    pub recorder: Recorder,
    pub child: Option<Child>,
}

#[derive(Clone)]
pub(crate) struct SessionCtx {
    pub db: Arc<Db>,
    stored: Arc<Mutex<StoredSession>>,
}

impl SessionCtx {
    pub fn new(db: Arc<Db>, stored: Arc<Mutex<StoredSession>>) -> Self {
        Self { db, stored }
    }

    pub fn with_mut<R>(&self, f: impl FnOnce(&mut StoredSession) -> R) -> R {
        f(&mut self.stored.lock().expect("stored session lock"))
    }

    pub fn record(&self) -> RuntimeSessionRecord {
        self.with_mut(|session| to_runtime_record(session))
    }

    pub async fn wait_pause(&self) {
        let gate = self.with_mut(|session| Arc::clone(&session.pause_gate));
        gate.wait_if_paused().await;
    }

    pub fn set_phase(&self, phase: RuntimeSessionPhase) {
        self.with_mut(|session| session.phase = phase);
    }

    pub fn set_child(&self, child: Child) {
        self.with_mut(|session| session.child = Some(child));
    }

    pub fn append_event(&self, kind: SessionEventKind, payload: Value) {
        let session_id = self.with_mut(|session| session.session_id.clone());
        append_event(&self.db, &session_id, kind, payload);
    }

    pub fn handle_session_update(&self, notification: SessionNotification) {
        self.with_mut(|session| {
            if session.status != RuntimeSessionStatus::Running {
                return;
            }
            session.phase = RuntimeSessionPhase::Streaming;
            let db = Arc::clone(&self.db);
            let session_id = session.session_id.clone();
            session.recorder.handle_update(&notification, &mut |kind, payload| {
                append_event(&db, &session_id, kind, payload);
            });
        });
    }

    pub fn complete_from_stop_reason(&self, stop_reason: StopReason) {
        self.with_mut(|session| session.phase = RuntimeSessionPhase::Terminal);
        match stop_reason {
            StopReason::EndTurn => self.finish(RuntimeSessionStatus::Succeeded, None, None),
            StopReason::Cancelled => self.finish(
                RuntimeSessionStatus::Cancelled,
                Some("cancelled_by_reconciliation".into()),
                None,
            ),
            StopReason::MaxTokens => self.finish(
                RuntimeSessionStatus::Failed,
                Some("stop_reason:max_tokens".into()),
                None,
            ),
            StopReason::MaxTurnRequests => self.finish(
                RuntimeSessionStatus::Failed,
                Some("stop_reason:max_turn_requests".into()),
                None,
            ),
            StopReason::Refusal => self.finish(
                RuntimeSessionStatus::Failed,
                Some("stop_reason:refusal".into()),
                None,
            ),
            _ => self.finish(
                RuntimeSessionStatus::Failed,
                Some(format!("stop_reason:{stop_reason:?}")),
                None,
            ),
        }
    }

    pub fn finish(
        &self,
        status: RuntimeSessionStatus,
        error_message: Option<String>,
        finished_at: Option<String>,
    ) {
        self.with_mut(|session| {
            if session.status != RuntimeSessionStatus::Running {
                return;
            }

            let db = Arc::clone(&self.db);
            let session_id = session.session_id.clone();
            session.recorder.flush(&mut |kind, payload| {
                append_event(&db, &session_id, kind, payload);
            });

            if let Some(message) = &error_message {
                append_event(
                    &db,
                    &session_id,
                    SessionEventKind::Error,
                    json!({ "message": message }),
                );
            }

            let finished_at = finished_at.unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
            session.status = status;
            session.error_message = error_message;
            session.finished_at = Some(finished_at.clone());
            session.phase = RuntimeSessionPhase::Terminal;

            let conn = db.conn();
            if let Ok(conn) = conn {
                let _ = AgentSessionRepo::new(&conn).finish(&session_id, status.as_str(), &finished_at);
            }
        });
    }

    pub fn check_child_exit(&self) -> Option<(RuntimeSessionStatus, Option<String>, Option<String>)> {
        self.with_mut(|session| {
            if session.status != RuntimeSessionStatus::Running {
                return None;
            }
            let child = session.child.as_mut()?;
            let status = child.try_wait().ok()??;
            if session.cancelled {
                return Some((
                    RuntimeSessionStatus::Cancelled,
                    Some("cancelled_by_reconciliation".into()),
                    None,
                ));
            }
            if session.phase == RuntimeSessionPhase::Terminal {
                return None;
            }
            let message = status
                .code()
                .map(|code| format!("early_process_exit_{code}"))
                .unwrap_or_else(|| "early_process_exit_unknown".into());
            Some((RuntimeSessionStatus::Failed, Some(message), None))
        })
    }

    pub fn fail(&self, error_message: String) {
        if self.with_mut(|session| session.cancelled || session.status != RuntimeSessionStatus::Running)
        {
            return;
        }
        self.finish(RuntimeSessionStatus::Failed, Some(error_message), None);
    }

    pub fn session_phase(&self) -> RuntimeSessionPhase {
        self.with_mut(|session| {
            if session.pause_gate.is_paused() && session.status == RuntimeSessionStatus::Running {
                RuntimeSessionPhase::Paused
            } else {
                session.phase
            }
        })
    }

    pub fn current_activity(&self) -> String {
        self.with_mut(|session| session.recorder.current_activity().to_string())
    }

    pub fn last_agent_message(&self) -> Option<String> {
        self.with_mut(|session| session.recorder.last_agent_message())
    }

    pub fn is_paused(&self) -> bool {
        self.with_mut(|session| session.pause_gate.is_paused())
    }

    pub fn poll(&self) {
        if let Some((status, error_message, finished_at)) = self.check_child_exit() {
            self.finish(status, error_message, finished_at);
        }
    }

    pub fn request_cancel(&self, reason: String, finished_at: String) -> bool {
        let should_finish = self.with_mut(|session| {
            if session.status != RuntimeSessionStatus::Running {
                return false;
            }
            session.cancelled = true;
            session.pause_gate.resume();
            true
        });
        if should_finish {
            self.finish(
                RuntimeSessionStatus::Cancelled,
                Some(reason),
                Some(finished_at),
            );
        }
        should_finish
    }
}

fn append_event(db: &Arc<Db>, session_id: &str, kind: SessionEventKind, payload: Value) {
    let Ok(conn) = db.conn() else {
        return;
    };
    let _ = SessionEventRepo::new(&conn).append(session_id, kind.as_str(), &payload.to_string());
}

fn to_runtime_record(session: &StoredSession) -> RuntimeSessionRecord {
    RuntimeSessionRecord {
        session_id: session.session_id.clone(),
        run_attempt_id: session.run_attempt_id.clone(),
        issue_id: session.issue_id.clone(),
        attempt_number: session.attempt_number,
        session_ref: session.agent_session_ref.clone(),
        status: session.status,
        started_at: session.started_at.clone(),
        finished_at: session.finished_at.clone(),
        error_message: session.error_message.clone(),
        paused: session.pause_gate.is_paused(),
    }
}

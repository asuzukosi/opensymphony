use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use std::sync::atomic::{AtomicBool, Ordering};

use tokio::sync::Notify;

use crate::db::error::{DbError, DbResult};
use crate::acp::PauseGate;

pub struct SessionPauseGate {
    paused: AtomicBool,
    notify: Notify,
}

impl SessionPauseGate {
    pub fn new() -> Self {
        Self {
            paused: AtomicBool::new(false),
            notify: Notify::new(),
        }
    }
}

impl Default for SessionPauseGate {
    fn default() -> Self {
        Self::new()
    }
}

impl PauseGate for SessionPauseGate {
    fn is_paused(&self) -> bool {
        self.paused.load(Ordering::Acquire)
    }

    fn wait_if_paused(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async {
            while self.paused.load(Ordering::Acquire) {
                self.notify.notified().await;
            }
        })
    }

    fn pause(&self) {
        self.paused.store(true, Ordering::Release);
    }

    fn resume(&self) {
        self.paused.store(false, Ordering::Release);
        self.notify.notify_waiters();
    }
}

#[derive(Default)]
pub struct PauseGateRegistry {
    gates: Mutex<HashMap<String, Arc<SessionPauseGate>>>,
}

impl PauseGateRegistry {
    pub fn register(&self, session_id: impl Into<String>, gate: Arc<SessionPauseGate>) {
        if let Ok(mut guard) = self.gates.lock() {
            guard.insert(session_id.into(), gate);
        }
    }

    pub fn remove(&self, session_id: &str) {
        if let Ok(mut guard) = self.gates.lock() {
            guard.remove(session_id);
        }
    }

    pub fn create_gate(&self) -> Arc<SessionPauseGate> {
        Arc::new(SessionPauseGate::new())
    }

    pub fn pause(&self, session_id: &str) -> DbResult<()> {
        let guard = self
            .gates
            .lock()
            .map_err(|_| DbError::Internal("pause gate registry lock poisoned".into()))?;
        let gate = guard
            .get(session_id)
            .ok_or_else(|| DbError::NotFound(format!("pause gate for session {session_id}")))?;
        gate.pause();
        Ok(())
    }

    pub fn resume(&self, session_id: &str) -> DbResult<()> {
        let guard = self
            .gates
            .lock()
            .map_err(|_| DbError::Internal("pause gate registry lock poisoned".into()))?;
        let gate = guard
            .get(session_id)
            .ok_or_else(|| DbError::NotFound(format!("pause gate for session {session_id}")))?;
        gate.resume();
        Ok(())
    }

    pub fn is_paused(&self, session_id: &str) -> bool {
        self.gates
            .lock()
            .ok()
            .and_then(|guard| guard.get(session_id).map(|gate| gate.is_paused()))
            .unwrap_or(false)
    }
}


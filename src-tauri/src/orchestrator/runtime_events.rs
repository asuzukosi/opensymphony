use tauri::{AppHandle, Emitter};

use crate::types::{RuntimeOrchestratorStatusPayload, RuntimeProjectEventPayload};

pub const RUNNING_CHANGED: &str = "runtime:running-changed";
pub const RETRY_CHANGED: &str = "runtime:retry-changed";
pub const FINISHED_CHANGED: &str = "runtime:finished-changed";
pub const ORCHESTRATOR_STATUS: &str = "runtime:orchestrator-status";

#[derive(Clone)]
pub struct RuntimeEventEmitter {
    app: Option<AppHandle>,
}

impl RuntimeEventEmitter {
    pub fn new(app: AppHandle) -> Self {
        Self { app: Some(app) }
    }

    #[cfg(test)]
    pub fn noop() -> Self {
        Self { app: None }
    }

    pub fn running_changed(&self, project_id: &str) {
        self.emit(
            RUNNING_CHANGED,
            RuntimeProjectEventPayload {
                project_id: project_id.to_string(),
            },
        );
    }

    pub fn retry_changed(&self, project_id: &str) {
        self.emit(
            RETRY_CHANGED,
            RuntimeProjectEventPayload {
                project_id: project_id.to_string(),
            },
        );
    }

    pub fn finished_changed(&self, project_id: &str) {
        self.emit(
            FINISHED_CHANGED,
            RuntimeProjectEventPayload {
                project_id: project_id.to_string(),
            },
        );
    }

    pub fn orchestrator_status(&self, project_id: &str, status: &str) {
        self.emit(
            ORCHESTRATOR_STATUS,
            RuntimeOrchestratorStatusPayload {
                project_id: project_id.to_string(),
                status: status.to_string(),
            },
        );
    }

    fn emit<T: serde::Serialize + Clone>(&self, event: &str, payload: T) {
        let Some(app) = &self.app else {
            return;
        };
        if let Err(err) = app.emit(event, payload) {
            log::warn!("runtime event emit failed ({event}): {err}");
        }
    }
}

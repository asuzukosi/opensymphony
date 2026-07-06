use crate::stubs::state as state_stub;
use crate::types::{ControlRuntimeRequest, RuntimeStateSnapshot};

#[tauri::command(rename = "opensymphony:control-runtime")]
pub fn control_runtime(request: ControlRuntimeRequest) -> RuntimeStateSnapshot {
    let _ = request;
    state_stub::idle_runtime_snapshot(10)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::RuntimeStatus;

    #[test]
    fn returns_idle_snapshot_for_start_request() {
        let snapshot = control_runtime(ControlRuntimeRequest::Start {});

        assert_eq!(snapshot.status, RuntimeStatus::Idle);
        assert!(snapshot.running.is_empty());
        assert!(snapshot.retrying.is_empty());
        assert!(snapshot.candidates.is_empty());
        assert!(snapshot.recent_finished.is_empty());
        assert!(snapshot.recent_events.is_empty());
        assert!(snapshot.validation_error.is_none());
    }
}

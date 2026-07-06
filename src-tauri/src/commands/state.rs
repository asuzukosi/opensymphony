use crate::stubs::state as state_stub;
use crate::types::RuntimeStateSnapshot;

const DEFAULT_EVENT_LIMIT: u32 = 10;
const MAX_EVENT_LIMIT: u32 = 200;

fn clamp_event_limit(event_limit: Option<u32>) -> u32 {
    let limit = event_limit.unwrap_or(DEFAULT_EVENT_LIMIT);
    limit.min(MAX_EVENT_LIMIT)
}

#[tauri::command(rename = "opensymphony:get-runtime-state")]
pub fn get_runtime_state(event_limit: Option<u32>) -> RuntimeStateSnapshot {
    state_stub::idle_runtime_snapshot(clamp_event_limit(event_limit))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::RuntimeStatus;

    #[test]
    fn returns_idle_snapshot_with_empty_collections() {
        let snapshot = get_runtime_state(Some(0));

        assert_eq!(snapshot.status, RuntimeStatus::Idle);
        assert!(snapshot.running.is_empty());
        assert!(snapshot.retrying.is_empty());
        assert!(snapshot.candidates.is_empty());
        assert!(snapshot.recent_finished.is_empty());
        assert!(snapshot.recent_events.is_empty());
        assert!(snapshot.validation_error.is_none());
    }
}

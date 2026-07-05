use crate::types::{RuntimeStateSnapshot, RuntimeStatus};

pub fn idle_runtime_snapshot(_event_limit: u32) -> RuntimeStateSnapshot {
    RuntimeStateSnapshot {
        status: RuntimeStatus::Idle,
        started_at: None,
        poll_interval_ms: 3000,
        next_tick_at: None,
        tick_count: 0,
        last_tick_at: None,
        last_dispatched_count: 0,
        last_action: None,
        last_error: None,
        validation_error: None,
        running: Vec::new(),
        retrying: Vec::new(),
        recent_finished: Vec::new(),
        candidates: Vec::new(),
        recent_events: Vec::new(),
    }
}

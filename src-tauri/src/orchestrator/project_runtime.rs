use chrono::{DateTime, Utc};
use crate::types::RuntimeStatus;

pub struct ProjectRuntime {
    project_id: String,
    status: RuntimeStatus,
    started_at: Option<DateTime<Utc>>,
    poll_interval_override: Option<u32>,
    next_tick_at: Option<DateTime<Utc>>,
    tick_count: u32,
    last_tick_at: Option<DateTime<Utc>>,
    last_dispatched_count: u32,
    last_action: Option<String>,
    last_error: Option<String>,
    timer: Option<tokio::task::JoinHandle<()>>,
}

impl ProjectRuntime {
    pub fn new(project_id: String) -> Self {
        Self {
            project_id,
            status: RuntimeStatus::Idle,
            started_at: None,
            poll_interval_override: None,
            next_tick_at: None,
            tick_count: 0,
            last_tick_at: None,
            last_dispatched_count: 0,
            last_action: None,
            last_error: None,
            timer: None,
        }
    }

    pub fn project_id(&self) -> &str {
        &self.project_id
    }

    pub fn status(&self) -> RuntimeStatus {
        self.status
    }

    pub fn started_at(&self) -> Option<DateTime<Utc>> {
        self.started_at
    }

    pub fn poll_interval_override(&self) -> Option<u32> {
        self.poll_interval_override
    }

    pub fn set_poll_interval_override(&mut self, poll_interval_ms: u32) {
        self.poll_interval_override = Some(poll_interval_ms);
    }

    pub fn clear_poll_interval_override(&mut self) {
        self.poll_interval_override = None;
    }

    pub fn next_tick_at(&self) -> Option<DateTime<Utc>> {
        self.next_tick_at
    }

    pub fn set_next_tick_at(&mut self, next_tick_at: Option<DateTime<Utc>>) {
        self.next_tick_at = next_tick_at;
    }

    pub fn tick_count(&self) -> u32 {
        self.tick_count
    }

    pub fn last_tick_at(&self) -> Option<DateTime<Utc>> {
        self.last_tick_at
    }

    pub fn last_dispatched_count(&self) -> u32 {
        self.last_dispatched_count
    }

    pub fn set_last_dispatched_count(&mut self, count: u32) {
        self.last_dispatched_count = count;
    }

    pub fn last_action(&self) -> Option<&str> {
        self.last_action.as_deref()
    }

    pub fn last_error(&self) -> Option<&str> {
        self.last_error.as_deref()
    }

    pub fn set_last_error(&mut self, message: impl Into<String>) {
        self.last_error = Some(message.into());
    }

    pub fn start(&mut self) {
        if self.started_at.is_none() {
            self.started_at = Some(Utc::now());
        }
        self.status = RuntimeStatus::Running;
    }

    pub fn stop(&mut self) {
        self.abort_timer();
        self.status = RuntimeStatus::Stopped;
        self.next_tick_at = None;
    }

    pub fn tick_now(&mut self) {
        self.tick_count = self.tick_count.saturating_add(1);
        self.last_tick_at = Some(Utc::now());
        self.last_action = Some("tick_completed".into());
        self.last_error = None;
    }

    pub(crate) fn set_timer(&mut self, handle: tokio::task::JoinHandle<()>) {
        self.abort_timer();
        self.timer = Some(handle);
    }

    fn abort_timer(&mut self) {
        if let Some(handle) = self.timer.take() {
            handle.abort();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_runtime_has_empty_metrics() {
        let runtime = ProjectRuntime::new("p1".into());

        assert_eq!(runtime.status(), RuntimeStatus::Idle);
        assert_eq!(runtime.tick_count(), 0);
        assert!(runtime.last_tick_at().is_none());
        assert_eq!(runtime.poll_interval_override(), None);
    }

    #[test]
    fn tick_now_updates_metrics() {
        let mut runtime = ProjectRuntime::new("p1".into());

        runtime.tick_now();

        assert_eq!(runtime.tick_count(), 1);
        assert!(runtime.last_tick_at().is_some());
        assert_eq!(runtime.last_action(), Some("tick_completed"));
        assert!(runtime.last_error().is_none());
    }

    #[test]
    fn poll_interval_override_roundtrip() {
        let mut runtime = ProjectRuntime::new("p1".into());

        runtime.set_poll_interval_override(5000);
        assert_eq!(runtime.poll_interval_override(), Some(5000));

        runtime.clear_poll_interval_override();
        assert_eq!(runtime.poll_interval_override(), None);
    }

    #[tokio::test]
    async fn stop_aborts_timer_handle() {
        let mut runtime = ProjectRuntime::new("p1".into());
        runtime.set_timer(tokio::spawn(async {
            tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
        }));

        runtime.stop();

        assert_eq!(runtime.status(), RuntimeStatus::Stopped);
        assert!(runtime.next_tick_at().is_none());
    }
}

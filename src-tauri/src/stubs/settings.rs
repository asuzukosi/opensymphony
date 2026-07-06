use crate::types::{SettingsView, RuntimeStatus, PollIntervalSource, PermissionMode, PermissionModeSource};

pub fn sample_settings_view() -> SettingsView {
    SettingsView {
        status: RuntimeStatus::Running,
        workflow_path: None,
        workflow_version: None,
        prompt_template: "testing".into(),
        poll_interval_ms: 10,
        poll_interval_source: PollIntervalSource::Workflow,
        permission_mode: PermissionMode::AutoApprove,
        permission_mode_source: PermissionModeSource::Workflow,
        projects: Vec::new(),
        agents: Vec::new(),
        started_at: None,
        next_tick_at: None,
        tick_count: 100,
        last_tick_at: None,
        last_action: None,
        last_error: None,
    }
}
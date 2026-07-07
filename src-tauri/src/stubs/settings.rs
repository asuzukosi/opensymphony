use crate::stubs::constants::{
    STUB_AGENT_ID, STUB_AGENT_NAME, STUB_POLL_INTERVAL_MS, STUB_PROJECT_ID, STUB_PROJECT_NAME,
    STUB_PROJECT_SLUG, STUB_PROMPT_TEMPLATE,
};
use crate::types::{
    Agent, PermissionMode, PermissionModeSource, PollIntervalSource, RuntimeStatus,
    SettingsProjectMeta, SettingsView,
};

pub fn sample_settings_view() -> SettingsView {
    SettingsView {
        status: RuntimeStatus::Idle,
        workflow_path: None,
        workflow_version: None,
        prompt_template: STUB_PROMPT_TEMPLATE.into(),
        poll_interval_ms: STUB_POLL_INTERVAL_MS,
        poll_interval_source: PollIntervalSource::Workflow,
        permission_mode: PermissionMode::AutoApprove,
        permission_mode_source: PermissionModeSource::Workflow,
        projects: vec![SettingsProjectMeta {
            id: STUB_PROJECT_ID.into(),
            name: STUB_PROJECT_NAME.into(),
            slug: STUB_PROJECT_SLUG.into(),
            agents: vec![STUB_AGENT_ID.into()],
        }],
        agents: vec![Agent {
            id: STUB_AGENT_ID.into(),
            name: STUB_AGENT_NAME.into(),
            acp_command: Some("echo".into()),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
        }],
        started_at: None,
        next_tick_at: None,
        tick_count: 0,
        last_tick_at: None,
        last_action: None,
        last_error: None,
    }
}

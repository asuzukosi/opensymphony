use crate::stubs::settings as settings_stubs;
use crate::types::SettingsView;

#[tauri::command(rename = "opensymphony:get-settings")]
pub fn get_settings() -> SettingsView {
    settings_stubs::sample_settings_view()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::stubs::constants::{STUB_POLL_INTERVAL_MS, STUB_PROJECT_ID};
    use crate::types::RuntimeStatus;

    #[test]
    fn returns_stub_settings_aligned_with_runtime() {
        let settings = get_settings();

        assert_eq!(settings.status, RuntimeStatus::Idle);
        assert_eq!(settings.poll_interval_ms, STUB_POLL_INTERVAL_MS);
        assert_eq!(settings.tick_count, 0);
        assert_eq!(settings.projects.len(), 1);
        assert_eq!(settings.projects[0].id, STUB_PROJECT_ID);
        assert_eq!(settings.agents.len(), 1);
        assert_eq!(settings.agents[0].id, settings.projects[0].agents[0]);
    }
}

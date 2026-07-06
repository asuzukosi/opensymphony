use crate::stubs::settings as settings_stubs;
use crate::types::{SettingsView};

#[tauri::command]
pub fn get_settings() -> SettingsView {
    settings_stubs::sample_settings_view()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retuns_empty_settings() {
        let settings = get_settings();

        assert_eq!(settings.projects, 0);
    

        for column_id in BoardColumnId::ALL {
            assert!(board.column(column_id).issues.len() <= 1);
        }
    }
}
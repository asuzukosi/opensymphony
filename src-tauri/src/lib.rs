mod acp;
mod commands;
mod orchestrator;
mod runtime;
mod stubs;
mod types;
use tauri::Manager;
use acp::AcpState;
use commands::{get_issue, get_project_board, get_runtime_state, mutate_issue, control_runtime, get_settings, get_pending_permissions, resolve_permission};


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            app.manage(AcpState::new(tauri::async_runtime::handle()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_runtime_state,
            get_project_board,
            get_issue,
            mutate_issue,
            control_runtime,
            get_settings, 
            get_pending_permissions,
            resolve_permission,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

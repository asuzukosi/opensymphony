mod acp;
mod commands;
mod db;
mod orchestrator;
mod runtime;
mod stubs;
mod types;

use tauri::Manager;

use acp::AcpState;
use commands::{
    control_runtime, get_board_column, get_board_issue_card, get_issue, get_issue_header,
    get_pending_permissions, get_project_board, get_runtime_state, get_settings, list_issue_comments,
    list_issue_run_attempts, list_session_events, mutate_issue, resolve_permission,
};
use db::Db;

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

            let db_path = Db::db_path(app.handle())?;
            let database = Db::open(&db_path)?;
            app.manage(database);

            app.manage(AcpState::new(tauri::async_runtime::handle()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_runtime_state,
            get_project_board,
            get_board_column,
            get_board_issue_card,
            get_issue,
            get_issue_header,
            list_issue_comments,
            list_issue_run_attempts,
            list_session_events,
            mutate_issue,
            control_runtime,
            get_settings, 
            get_pending_permissions,
            resolve_permission,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

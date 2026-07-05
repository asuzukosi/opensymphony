mod commands;
mod stubs;
mod types;

use commands::{get_project_board, get_runtime_state};

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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_runtime_state, get_project_board])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

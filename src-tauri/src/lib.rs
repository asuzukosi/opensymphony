mod acp;
mod commands;
mod db;
mod orchestrator;
mod utils;
mod types;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use acp::AcpState;
use orchestrator::Manager as OrchestratorManager;
use orchestrator::events::orchestrator_event_channel;
use orchestrator::workspace::WorkspaceManager;
use commands::{
    // task
    add_task_comment, attach_task_files, create_task, get_task_header, list_task_comments,
    list_task_pending_permissions, list_task_run_attempts, list_project_tasks,
    list_session_events, resolve_session_permission, set_task_auto_approve_permissions,
    set_task_executor, set_task_tags, transition_task_column,
    update_task_priority,
    // runtime
    cancel_run, get_runtime_recent_finished, get_runtime_retrying,
    get_runtime_running, pause_run, resume_run,
    // project
    create_project, delete_project, get_project_max_concurrency,
    get_project_retry_policy, list_project_summaries,
    set_project_max_concurrency, set_project_name,
    set_project_retry_policy,
    // platform
    list_platform_statuses, list_project_platforms,
    // analytics
    get_agent_activity_over_time,
};
use db::{Db, DbError};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_data_dir = Db::app_data_dir(app.handle())?;
            let db_path = app_data_dir.join(db::DB_FILE_NAME);
            let database = Arc::new(Db::open(&db_path)?);
            app.manage(Arc::clone(&database));
            let (event_tx, event_rx) = orchestrator_event_channel();
            let (acp_state, adapter) = AcpState::new(
                tauri::async_runtime::handle(),
                Arc::clone(&database),
                event_tx.clone(),
            );
            app.manage(acp_state);
            let manager = Arc::new(Mutex::new(OrchestratorManager::new(
                Arc::clone(&database),
                tauri::async_runtime::handle(),
                adapter,
                WorkspaceManager::from_app_data(&app_data_dir),
                event_rx,
                app.handle().clone(),
            )));
            OrchestratorManager::attach_handle(&manager);
            {
                let conn = database.conn()?;
                manager
                    .lock()
                    .map_err(|_| DbError::Internal("orchestrator lock poisoned".into()))?
                    .hydrate_from_db(&conn)?;
            }
            app.manage(manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // task
            get_task_header,
            list_project_tasks,
            list_task_comments,
            list_task_run_attempts,
            list_session_events,
            add_task_comment,
            attach_task_files,
            create_task,
            set_task_executor,
            set_task_auto_approve_permissions,
            set_task_tags,
            transition_task_column,
            update_task_priority,
            list_task_pending_permissions,
            resolve_session_permission,
            // runtime
            get_runtime_running,
            get_runtime_retrying,
            get_runtime_recent_finished,
            pause_run,
            resume_run,
            cancel_run,
            // project
            list_project_summaries,
            get_project_max_concurrency,
            get_project_retry_policy,
            create_project,
            delete_project,
            set_project_name,
            set_project_max_concurrency,
            set_project_retry_policy,
            // platform
            list_platform_statuses,
            list_project_platforms,
            // analytics
            get_agent_activity_over_time,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
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
use orchestrator::workspace::WorkspaceManager;
use commands::{
    // issue
    add_issue_comment, attach_issue_files, create_issue, get_issue_header, list_issue_comments,
    list_issue_pending_permissions, list_issue_run_attempts, list_project_issues,
    list_session_events, resolve_session_permission, set_issue_auto_approve_permissions,
    set_issue_executor, set_issue_tags, transition_issue_column, update_issue_description,
    update_issue_priority, update_issue_title,
    // runtime
    cancel_run, clear_runtime_poll_interval_override, get_runtime_candidates,
    get_runtime_recent_events, get_runtime_recent_finished, get_runtime_retrying,
    get_runtime_running, get_runtime_summary, pause_run, resume_run, set_runtime_poll_interval,
    start_runtime, stop_runtime, tick_runtime,
    // project
    create_project, delete_project, get_project_max_concurrency, get_project_name,
    get_project_orchestrator_status, get_project_poll_interval,
    get_project_prompt_template, get_project_retry_policy, list_project_summaries,
    set_project_max_concurrency, set_project_name, set_project_poll_interval,
    set_project_prompt_template, set_project_retry_policy,
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
            let (acp_state, adapter) = AcpState::new(
                tauri::async_runtime::handle(),
                Arc::clone(&database),
            );
            app.manage(acp_state);
            let manager = Arc::new(Mutex::new(OrchestratorManager::new(
                Arc::clone(&database),
                tauri::async_runtime::handle(),
                adapter,
                WorkspaceManager::from_app_data(&app_data_dir),
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
            // issue
            get_issue_header,
            list_project_issues,
            list_issue_comments,
            list_issue_run_attempts,
            list_session_events,
            add_issue_comment,
            attach_issue_files,
            create_issue,
            set_issue_executor,
            set_issue_auto_approve_permissions,
            set_issue_tags,
            transition_issue_column,
            update_issue_description,
            update_issue_priority,
            update_issue_title,
            list_issue_pending_permissions,
            resolve_session_permission,
            // runtime
            get_runtime_summary,
            get_runtime_running,
            get_runtime_retrying,
            get_runtime_candidates,
            get_runtime_recent_finished,
            get_runtime_recent_events,
            start_runtime,
            stop_runtime,
            tick_runtime,
            set_runtime_poll_interval,
            clear_runtime_poll_interval_override,
            pause_run,
            resume_run,
            cancel_run,
            // project
            list_project_summaries,
            get_project_name,
            get_project_prompt_template,
            get_project_poll_interval,
            get_project_max_concurrency,
            get_project_retry_policy,
            get_project_orchestrator_status,
            create_project,
            delete_project,
            set_project_name,
            set_project_prompt_template,
            set_project_poll_interval,
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
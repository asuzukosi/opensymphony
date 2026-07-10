mod acp;
mod commands;
mod db;
mod orchestrator;
mod types;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use acp::AcpState;
use orchestrator::Manager as OrchestratorManager;
use orchestrator::workspace::WorkspaceManager;
use commands::{
    // board reads
    get_board_column, get_board_issue_card,
    // issue reads
    get_issue_header, list_issue_comments, list_issue_run_attempts, list_session_events,
    // issue writes
    add_issue_comment, create_issue, transition_issue_column, update_issue_description,
    update_issue_priority, update_issue_title,
    // permissions reads
    list_issue_pending_permissions,
    // permissions writes
    resolve_session_permission,
    // runtime reads
    get_runtime_summary, get_runtime_running, get_runtime_retrying, get_runtime_candidates,
    get_runtime_recent_finished, get_runtime_recent_events,
    // runtime writes
    start_runtime, stop_runtime, tick_runtime, set_runtime_poll_interval,
    clear_runtime_poll_interval_override, pause_run, resume_run, cancel_run,
    // project reads
    list_project_summaries, get_project_name, get_project_workflow_source,
    get_project_workflow_file_path, get_project_workflow_version, get_project_prompt_template,
    get_project_poll_interval, get_project_max_concurrency, get_project_retry_policy,
    get_project_permission_mode, get_project_orchestrator_status,
    // project writes
    create_project, delete_project, set_project_name, set_project_workflow_file,
    import_project_workflow_file, set_project_prompt_template, set_project_poll_interval,
    set_project_max_concurrency, set_project_retry_policy, set_project_permission_mode,
    // agent reads
    list_agent_summaries, get_agent, list_project_agent_ids,
    // agent writes
    create_agent, delete_agent, set_agent_name, set_agent_acp_command,
    assign_agent_to_project, unassign_agent_from_project,
    // analytics reads
    get_project_agent_activity_over_time, get_project_permission_activity_over_time,
    // app state reads
    get_active_project_id,
    // app state writes
    set_active_project_id,
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
            let permission_gate = Arc::clone(&acp_state.permission_gate);
            app.manage(acp_state);
            let manager = Arc::new(Mutex::new(OrchestratorManager::new(
                Arc::clone(&database),
                tauri::async_runtime::handle(),
                adapter,
                Arc::clone(&permission_gate),
                WorkspaceManager::from_app_data(&app_data_dir),
            )));
            OrchestratorManager::attach_handle(&manager);
            {
                let conn = database.conn()?;
                permission_gate.hydrate_project_modes(&conn)?;
                manager
                    .lock()
                    .map_err(|_| DbError::Internal("orchestrator lock poisoned".into()))?
                    .hydrate_from_db(&conn)?;
            }
            app.manage(manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // board reads
            get_board_column,
            get_board_issue_card,
            // issue reads
            get_issue_header,
            list_issue_comments,
            list_issue_run_attempts,
            list_session_events,
            // issue writes
            create_issue,
            update_issue_title,
            update_issue_description,
            update_issue_priority,
            transition_issue_column,
            add_issue_comment,
            // permissions reads
            list_issue_pending_permissions,
            // permissions writes
            resolve_session_permission,
            // runtime reads
            get_runtime_summary,
            get_runtime_running,
            get_runtime_retrying,
            get_runtime_candidates,
            get_runtime_recent_finished,
            get_runtime_recent_events,
            // runtime writes
            start_runtime,
            stop_runtime,
            tick_runtime,
            set_runtime_poll_interval,
            clear_runtime_poll_interval_override,
            pause_run,
            resume_run,
            cancel_run,
            // project reads
            list_project_summaries,
            get_project_name,
            get_project_workflow_source,
            get_project_workflow_file_path,
            get_project_workflow_version,
            get_project_prompt_template,
            get_project_poll_interval,
            get_project_max_concurrency,
            get_project_retry_policy,
            get_project_permission_mode,
            get_project_orchestrator_status,
            // project writes
            create_project,
            delete_project,
            set_project_name,
            set_project_workflow_file,
            import_project_workflow_file,
            set_project_prompt_template,
            set_project_poll_interval,
            set_project_max_concurrency,
            set_project_retry_policy,
            set_project_permission_mode,
            // agent reads
            list_agent_summaries,
            get_agent,
            list_project_agent_ids,
            // agent writes
            create_agent,
            delete_agent,
            set_agent_name,
            set_agent_acp_command,
            assign_agent_to_project,
            unassign_agent_from_project,
            // analytics reads
            get_project_agent_activity_over_time,
            get_project_permission_activity_over_time,
            // app state reads
            get_active_project_id,
            // app state writes
            set_active_project_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
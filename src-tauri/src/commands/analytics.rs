use std::sync::Arc;
use tauri::State;

use crate::db::repos::analytics::AnalyticsRepo;
use crate::db::Db;
use crate::types::{
    ActivityTimeRange, AgentActivityOverTimeResponse, PermissionActivityOverTimeResponse,
};

#[tauri::command(rename = "opensymphony:get-project-agent-activity-over-time")]
pub fn get_project_agent_activity_over_time(
    db: State<Arc<Db>>,
    project_id: String,
    time_range: ActivityTimeRange,
) -> Result<AgentActivityOverTimeResponse, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    AnalyticsRepo::new(&conn)
        .agent_activity_over_time(&project_id, &time_range)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:get-project-permission-activity-over-time")]
pub fn get_project_permission_activity_over_time(
    db: State<Arc<Db>>,
    project_id: String,
    time_range: ActivityTimeRange,
) -> Result<PermissionActivityOverTimeResponse, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    AnalyticsRepo::new(&conn)
        .permission_activity_over_time(&project_id, &time_range)
        .map_err(|err| err.to_string())
}

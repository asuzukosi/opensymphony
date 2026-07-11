use std::sync::Arc;
use tauri::State;

use crate::db::repos::analytics::AnalyticsRepo;
use crate::db::Db;
use crate::types::{ActivityTimeRange, AgentActivityOverTimeResponse};

#[tauri::command(rename = "opensymphony:get-agent-activity-over-time")]
pub fn get_agent_activity_over_time(
    db: State<Arc<Db>>,
    time_range: ActivityTimeRange,
    project_id: Option<String>,
) -> Result<AgentActivityOverTimeResponse, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    AnalyticsRepo::new(&conn)
        .list_agent_activity_over_time(&time_range, project_id.as_deref())
        .map_err(|err| err.to_string())
}

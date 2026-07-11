use crate::types::PlatformInstallStatus;
use crate::db::repos::platforms::PlatformsRepo;
use crate::utils::list_install_statuses;
use std::sync::Arc;
use tauri::State;
use crate::db::Db;

#[tauri::command(rename = "opensymphony:list-platform-statuses")]
pub fn list_platform_statuses() -> Result<Vec<PlatformInstallStatus>, String> {
    Ok(list_install_statuses())
}

#[tauri::command(rename = "opensymphony:list-project-platforms")]
pub fn list_project_platforms(
    db: State<Arc<Db>>,
    project_id: String,
) -> Result<Vec<String>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    PlatformsRepo::new(&conn)
        .list(&project_id)
        .map_err(|err| err.to_string())
}

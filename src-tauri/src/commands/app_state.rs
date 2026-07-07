use tauri::State;

use crate::db::repos::app_state::AppStateRepo;
use crate::db::Db;

// reads

#[tauri::command(rename = "opensymphony:get-active-project-id")]
pub fn get_active_project_id(db: State<Db>) -> Result<Option<String>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    AppStateRepo::new(&conn)
        .get_active_project_id()
        .map_err(|err| err.to_string())
}

// writes

#[tauri::command(rename = "opensymphony:set-active-project-id")]
pub fn set_active_project_id(
    db: State<Db>,
    project_id: Option<String>,
) -> Result<Option<String>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    AppStateRepo::new(&conn)
        .set_active_project_id(project_id.as_deref())
        .map_err(|err| err.to_string())?;
    AppStateRepo::new(&conn)
        .get_active_project_id()
        .map_err(|err| err.to_string())
}

use tauri::State;

use crate::db::error::DbError;
use crate::db::repos::issue::IssueRepo;
use crate::db::Db;
use crate::types::{BoardColumn, BoardColumnId, ProjectBoardIssue};

#[tauri::command(rename = "opensymphony:get-board-column")]
pub fn get_board_column(
    db: State<Db>,
    project_id: String,
    column: BoardColumnId,
) -> Result<BoardColumn, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let issues = IssueRepo::new(&conn)
        .list_by_column(&project_id, column)
        .map_err(|err| err.to_string())?;
    Ok(BoardColumn { issues })
}

#[tauri::command(rename = "opensymphony:get-board-issue-card")]
pub fn get_board_issue_card(db: State<Db>, issue_id: String) -> Result<ProjectBoardIssue, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    IssueRepo::new(&conn)
        .get_card(&issue_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| DbError::NotFound(format!("issue {issue_id}")).to_string())
}

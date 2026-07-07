use rusqlite::Connection;
use tauri::State;

use crate::db::error::DbResult;
use crate::db::repos::issue::IssueRepo;
use crate::db::Db;
use crate::stubs::board;
use crate::types::{BoardColumn, BoardColumnId, ProjectBoard, ProjectBoardIssue};

#[tauri::command(rename = "opensymphony:get-project-board")]
pub fn get_project_board() -> ProjectBoard {
    board::sample_project_board()
}

#[tauri::command(rename = "opensymphony:get-board-column")]
pub fn get_board_column(
    db: State<Db>,
    project_id: String,
    column: BoardColumnId,
) -> Result<BoardColumn, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    get_board_column_impl(&conn, &project_id, column).map_err(Into::into)
}

#[tauri::command(rename = "opensymphony:get-board-issue-card")]
pub fn get_board_issue_card(db: State<Db>, issue_id: String) -> Result<ProjectBoardIssue, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    get_board_issue_card_impl(&conn, &issue_id).map_err(Into::into)
}

fn get_board_column_impl(
    conn: &Connection,
    project_id: &str,
    column: BoardColumnId,
) -> DbResult<BoardColumn> {
    let repo = IssueRepo::new(conn);
    let cards = repo.list_by_column(project_id, column)?;
    Ok(BoardColumn {
        issues: cards,
    })
}

fn get_board_issue_card_impl(conn: &Connection, issue_id: &str) -> DbResult<ProjectBoardIssue> {
    let repo = IssueRepo::new(conn);
    repo.get_card(issue_id)?
        .ok_or_else(|| crate::db::error::DbError::NotFound(format!("issue {issue_id}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_helpers::{open_test_db, seed_minimal_project};

    #[test]
    fn db_board_reads_return_seeded_data() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed fixtures");

        let backlog = get_board_column_impl(
            &conn,
            &fixtures.project_id,
            BoardColumnId::Backlog,
        )
        .expect("get backlog column");
        assert_eq!(backlog.issues[0].identifier, "SYM-1");

        let card = get_board_issue_card_impl(&conn, &fixtures.backlog_issue_id)
            .expect("get backlog card");
        assert_eq!(card.title, "Backlog issue");
    }
}

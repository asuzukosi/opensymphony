use crate::stubs::board;
use crate::types::ProjectBoard;

#[tauri::command]
pub fn get_project_board() -> ProjectBoard {
    board::sample_project_board()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::BoardColumnId;

    #[test]
    fn returns_fixed_columns_with_sample_issues() {
        let board = get_project_board();

        assert_eq!(board.backlog.issues.len(), 1);
        assert_eq!(board.backlog.issues[0].identifier, "SYM-1");
        assert_eq!(board.in_progress.issues.len(), 1);
        assert_eq!(board.in_progress.issues[0].identifier, "SYM-2");
        assert!(board.review.issues.is_empty());
        assert!(board.done.issues.is_empty());

        for column_id in BoardColumnId::ALL {
            assert!(board.column(column_id).issues.len() <= 1);
        }
    }
}

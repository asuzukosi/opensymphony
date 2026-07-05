use crate::types::{BoardColumn, ProjectBoard, ProjectBoardIssue};

pub fn sample_project_board() -> ProjectBoard {
    ProjectBoard {
        backlog: BoardColumn {
            issues: vec![ProjectBoardIssue {
                issue_id: "stub-issue-1".into(),
                identifier: "SYM-1".into(),
                title: "Sample backlog issue".into(),
                priority: Some(2),
            }],
        },
        in_progress: BoardColumn {
            issues: vec![ProjectBoardIssue {
                issue_id: "stub-issue-2".into(),
                identifier: "SYM-2".into(),
                title: "Sample active issue".into(),
                priority: Some(1),
            }],
        },
        review: BoardColumn::default(),
        done: BoardColumn::default(),
    }
}

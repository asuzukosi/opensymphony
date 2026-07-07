use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

/// workflow column grouping used by orchestrator selection and issue workflow.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkflowStateCategory {
    Active,
    Terminal,
    Backlog,
    Other,
}

/// fixed kanban column ids — board layout is app-defined, not derived from workflow states.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BoardColumnId {
    Backlog,
    InProgress,
    Review,
    Done,
}

impl BoardColumnId {
    pub const ALL: [Self; 4] = [Self::Backlog, Self::InProgress, Self::Review, Self::Done];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Backlog => "backlog",
            Self::InProgress => "inProgress",
            Self::Review => "review",
            Self::Done => "done",
        }
    }
}

impl fmt::Display for BoardColumnId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for BoardColumnId {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "backlog" => Ok(Self::Backlog),
            "inProgress" => Ok(Self::InProgress),
            "review" => Ok(Self::Review),
            "done" => Ok(Self::Done),
            _ => Err(()),
        }
    }
}

/// issue card on the project board (also used by issue repo list queries).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBoardIssue {
    pub issue_id: String,
    pub identifier: String,
    pub title: String,
    pub priority: Option<i32>,
}

/// issues in one fixed board column.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardColumn {
    pub issues: Vec<ProjectBoardIssue>,
}

impl Default for BoardColumn {
    fn default() -> Self {
        Self {
            issues: Vec::new(),
        }
    }
}

/// full board returned by get_project_board — always exposes the same four columns.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBoard {
    pub backlog: BoardColumn,
    pub in_progress: BoardColumn,
    pub review: BoardColumn,
    pub done: BoardColumn,
}

impl Default for ProjectBoard {
    fn default() -> Self {
        Self {
            backlog: BoardColumn::default(),
            in_progress: BoardColumn::default(),
            review: BoardColumn::default(),
            done: BoardColumn::default(),
        }
    }
}

impl ProjectBoard {
    pub fn column(&self, id: BoardColumnId) -> &BoardColumn {
        match id {
            BoardColumnId::Backlog => &self.backlog,
            BoardColumnId::InProgress => &self.in_progress,
            BoardColumnId::Review => &self.review,
            BoardColumnId::Done => &self.done,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::BoardColumnId;

    #[test]
    fn board_column_id_round_trips() {
        for column in BoardColumnId::ALL {
            let parsed = column.as_str().parse::<BoardColumnId>().expect("parse column");
            assert_eq!(parsed, column);
        }
    }
}

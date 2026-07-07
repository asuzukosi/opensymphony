use serde::{Deserialize, Serialize};

use super::board::BoardColumnId;
use super::comment::IssueComment;
use super::session::{AgentSession, RunAttempt, SessionEvent};

/// full issue row from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    pub id: String,
    pub project_id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub board_column: BoardColumnId,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Default)]
pub struct IssuePatch {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<i32>,
}

/// slim issue slice for the issue detail header.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueHeader {
    pub issue_id: String,
    pub project_id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub board_column: BoardColumnId,
}

impl From<Issue> for IssueHeader {
    fn from(issue: Issue) -> Self {
        Self {
            issue_id: issue.id,
            project_id: issue.project_id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            priority: issue.priority,
            board_column: issue.board_column,
        }
    }
}

/// agent session nested under a run attempt on the issue detail view.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueDetailSession {
    pub session_id: String,
    pub session_ref: Option<String>,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub events: Vec<SessionEvent>,
}

impl From<AgentSession> for IssueDetailSession {
    fn from(session: AgentSession) -> Self {
        Self {
            session_id: session.id,
            session_ref: session.session_ref,
            status: session.status,
            started_at: session.started_at,
            finished_at: session.finished_at,
            events: Vec::new(),
        }
    }
}

/// one orchestrator run attempt for an issue detail view.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueDetailRunAttempt {
    pub run_attempt_id: String,
    pub attempt_number: u32,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error_message: Option<String>,
    pub sessions: Vec<IssueDetailSession>,
}

impl From<RunAttempt> for IssueDetailRunAttempt {
    fn from(attempt: RunAttempt) -> Self {
        Self {
            run_attempt_id: attempt.id,
            attempt_number: attempt.attempt_number as u32,
            status: attempt.status,
            started_at: attempt.started_at,
            finished_at: attempt.finished_at,
            error_message: attempt.error_message,
            sessions: Vec::new(),
        }
    }
}

/// full issue payload returned by get_issue.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueDetail {
    pub issue_id: String,
    pub project_id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<i32>,
    pub workflow_state_id: String,
    pub workflow_state_name: String,
    pub comments: Vec<IssueComment>,
    pub attempts: Vec<IssueDetailRunAttempt>,
}

/// issue mutation payload for mutate_issue.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "lowercase")]
pub enum MutateIssueRequest {
    #[serde(rename_all = "camelCase")]
    Transition {
        issue_id: String,
        target_state_id: String,
        actor: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Comment {
        issue_id: String,
        body: String,
        author: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Create {
        project_id: String,
        title: String,
        description: Option<String>,
        priority: Option<i32>,
        workflow_state_id: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Update {
        issue_id: String,
        title: Option<String>,
        description: Option<String>,
        priority: Option<i32>,
    },
}

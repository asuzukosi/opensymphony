use tauri::State;

use crate::db::error::DbError;
use crate::db::repos::comment::CommentRepo;
use crate::db::repos::issue::IssueRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::db::repos::session_event::SessionEventRepo;
use crate::db::Db;
use crate::types::{
    BoardColumnId, IssueComment, IssueDetailRunAttempt, IssueHeader, IssuePatch, SessionEvent,
};

// reads

#[tauri::command(rename = "opensymphony:get-issue-header")]
pub fn get_issue_header(db: State<Db>, issue_id: String) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    IssueRepo::new(&conn)
        .get(&issue_id)?
        .map(IssueHeader::from)
        .ok_or_else(|| DbError::NotFound(format!("issue {issue_id}")).to_string())
}

#[tauri::command(rename = "opensymphony:list-issue-comments")]
pub fn list_issue_comments(
    db: State<Db>,
    issue_id: String,
) -> Result<Vec<IssueComment>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    CommentRepo::new(&conn)
        .list_by_issue(&issue_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:list-issue-run-attempts")]
pub fn list_issue_run_attempts(
    db: State<Db>,
    issue_id: String,
) -> Result<Vec<IssueDetailRunAttempt>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let attempts = RunAttemptRepo::new(&conn)
        .list_by_issue(&issue_id)
        .map_err(|err| err.to_string())?;
    Ok(attempts
        .into_iter()
        .map(IssueDetailRunAttempt::from)
        .collect())
}

#[tauri::command(rename = "opensymphony:list-session-events")]
pub fn list_session_events(
    db: State<Db>,
    issue_id: String,
) -> Result<Vec<SessionEvent>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    SessionEventRepo::new(&conn)
        .list_by_issue(&issue_id)
        .map_err(|err| err.to_string())
}

// writes

#[tauri::command(rename = "opensymphony:create-issue")]
pub fn create_issue(
    db: State<Db>,
    project_id: String,
    title: String,
    description: Option<String>,
) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    IssueRepo::new(&conn)
        .create(&project_id, &title, description.as_deref())
        .map(IssueHeader::from)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:update-issue-title")]
pub fn update_issue_title(
    db: State<Db>,
    issue_id: String,
    title: String,
) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    IssueRepo::new(&conn)
        .update(
            &issue_id,
            &IssuePatch {
                title: Some(title),
                ..Default::default()
            },
        )
        .map(IssueHeader::from)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:update-issue-description")]
pub fn update_issue_description(
    db: State<Db>,
    issue_id: String,
    description: Option<String>,
) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    IssueRepo::new(&conn)
        .update(
            &issue_id,
            &IssuePatch {
                description,
                ..Default::default()
            },
        )
        .map(IssueHeader::from)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:update-issue-priority")]
pub fn update_issue_priority(
    db: State<Db>,
    issue_id: String,
    priority: Option<i32>,
) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    IssueRepo::new(&conn)
        .update(
            &issue_id,
            &IssuePatch {
                priority,
                ..Default::default()
            },
        )
        .map(IssueHeader::from)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:transition-issue-column")]
pub fn transition_issue_column(
    db: State<Db>,
    issue_id: String,
    column: BoardColumnId,
    actor: Option<String>,
) -> Result<IssueHeader, String> {
    let _ = actor;
    let conn = db.conn().map_err(|err| err.to_string())?;
    IssueRepo::new(&conn)
        .transition_column(&issue_id, column)
        .map(IssueHeader::from)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:add-issue-comment")]
pub fn add_issue_comment(
    db: State<Db>,
    issue_id: String,
    body: String,
    author: Option<String>,
) -> Result<IssueComment, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    CommentRepo::new(&conn)
        .append(&issue_id, &body, author.as_deref())
        .map_err(|err| err.to_string())
}

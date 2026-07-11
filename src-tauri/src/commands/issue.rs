use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::db::error::DbError;
use crate::db::repos::comment::CommentRepo;
use crate::db::repos::issue::IssueRepo;
use crate::db::repos::issue_files::IssueFilesRepo;
use crate::db::repos::issue_tags::IssueTagsRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::db::repos::session_event::SessionEventRepo;
use crate::db::Db;
use crate::types::{
    BoardColumnId, Issue, IssueComment, IssueDetailRunAttempt, IssueFile, IssueHeader,
    IssuePatch, SessionEvent,
};

fn load_header(conn: &rusqlite::Connection, issue: Issue) -> Result<IssueHeader, String> {
    IssueRepo::new(conn)
        .build_header(issue)
        .map_err(|err| err.to_string())
}

fn load_header_by_id(conn: &rusqlite::Connection, issue_id: &str) -> Result<IssueHeader, String> {
    IssueRepo::new(conn)
        .get_header(issue_id)?
        .ok_or_else(|| DbError::NotFound(format!("issue {issue_id}")).to_string())
}

// reads

#[tauri::command(rename = "opensymphony:get-issue-header")]
pub fn get_issue_header(db: State<Arc<Db>>, issue_id: String) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    load_header_by_id(&conn, &issue_id)
}

#[tauri::command(rename = "opensymphony:list-issue-comments")]
pub fn list_issue_comments(
    db: State<Arc<Db>>,
    issue_id: String,
) -> Result<Vec<IssueComment>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    CommentRepo::new(&conn)
        .list_by_issue(&issue_id)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:list-issue-run-attempts")]
pub fn list_issue_run_attempts(
    db: State<Arc<Db>>,
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
    db: State<Arc<Db>>,
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
    db: State<Arc<Db>>,
    project_id: String,
    title: String,
    description: Option<String>,
    executor: Option<String>,
    priority: Option<i32>,
    tags: Option<Vec<String>>,
) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let issue = IssueRepo::new(&conn).create(
        &project_id,
        &title,
        description.as_deref(),
        executor.as_deref(),
        priority,
        &tags.unwrap_or_default(),
    )?;
    load_header(&conn, issue)
}

#[tauri::command(rename = "opensymphony:set-issue-executor")]
pub fn set_issue_executor(
    db: State<Arc<Db>>,
    issue_id: String,
    executor: Option<String>,
) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let issue = IssueRepo::new(&conn).set_executor(&issue_id, executor.as_deref())?;
    load_header(&conn, issue)
}

#[tauri::command(rename = "opensymphony:set-issue-tags")]
pub fn set_issue_tags(
    db: State<Arc<Db>>,
    issue_id: String,
    tags: Vec<String>,
) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    IssueTagsRepo::new(&conn).replace(&issue_id, &tags)?;
    load_header_by_id(&conn, &issue_id)
}

#[tauri::command(rename = "opensymphony:attach-issue-files")]
pub fn attach_issue_files(
    app: AppHandle,
    db: State<Arc<Db>>,
    issue_id: String,
    source_paths: Vec<String>,
) -> Result<Vec<IssueFile>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let app_data_dir = Db::app_data_dir(&app).map_err(|err| err.to_string())?;
    IssueFilesRepo::new(&conn).attach(app_data_dir.as_path(), &issue_id, &source_paths)
        .map_err(|err| err.to_string())
}

#[tauri::command(rename = "opensymphony:update-issue-title")]
pub fn update_issue_title(
    db: State<Arc<Db>>,
    issue_id: String,
    title: String,
) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let issue = IssueRepo::new(&conn).update(
        &issue_id,
        &IssuePatch {
            title: Some(title),
            ..Default::default()
        },
    )?;
    load_header(&conn, issue)
}

#[tauri::command(rename = "opensymphony:update-issue-description")]
pub fn update_issue_description(
    db: State<Arc<Db>>,
    issue_id: String,
    description: Option<String>,
) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let issue = IssueRepo::new(&conn).update(
        &issue_id,
        &IssuePatch {
            description,
            ..Default::default()
        },
    )?;
    load_header(&conn, issue)
}

#[tauri::command(rename = "opensymphony:update-issue-priority")]
pub fn update_issue_priority(
    db: State<Arc<Db>>,
    issue_id: String,
    priority: Option<i32>,
) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    let issue = IssueRepo::new(&conn).update(
        &issue_id,
        &IssuePatch {
            priority,
            ..Default::default()
        },
    )?;
    load_header(&conn, issue)
}

#[tauri::command(rename = "opensymphony:transition-issue-column")]
pub fn transition_issue_column(
    db: State<Arc<Db>>,
    issue_id: String,
    column: BoardColumnId,
    actor: Option<String>,
) -> Result<IssueHeader, String> {
    let _ = actor;
    let conn = db.conn().map_err(|err| err.to_string())?;
    let issue = IssueRepo::new(&conn).transition_column(&issue_id, column)?;
    load_header(&conn, issue)
}

#[tauri::command(rename = "opensymphony:add-issue-comment")]
pub fn add_issue_comment(
    db: State<Arc<Db>>,
    issue_id: String,
    body: String,
    author: Option<String>,
) -> Result<IssueComment, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    CommentRepo::new(&conn)
        .append(&issue_id, &body, author.as_deref())
        .map_err(|err| err.to_string())
}

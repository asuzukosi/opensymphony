use rusqlite::Connection;
use tauri::State;

use crate::db::error::DbResult;
use crate::db::repos::comment::CommentRepo;
use crate::db::repos::issue::IssueRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::db::repos::session_event::SessionEventRepo;
use crate::db::Db;
use crate::stubs::issue;
use crate::types::{
    IssueComment, IssueDetail, IssueDetailRunAttempt, IssueHeader, MutateIssueRequest,
    SessionEvent,
};

#[tauri::command(rename = "opensymphony:get-issue")]
pub fn get_issue(issue_id: String, attempt_limit: Option<u32>) -> Result<IssueDetail, String> {
    let _ = attempt_limit;
    issue::sample_issue_detail(&issue_id)
        .ok_or_else(|| format!("issue not found: {issue_id}"))
}

#[tauri::command(rename = "opensymphony:mutate-issue")]
pub fn mutate_issue(request: MutateIssueRequest) -> Result<(), String> {
    let _ = request;
    Ok(())
}

#[tauri::command(rename = "opensymphony:get-issue-header")]
pub fn get_issue_header(db: State<Db>, issue_id: String) -> Result<IssueHeader, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    get_issue_header_impl(&conn, &issue_id).map_err(Into::into)
}

#[tauri::command(rename = "opensymphony:list-issue-comments")]
pub fn list_issue_comments(
    db: State<Db>,
    issue_id: String,
) -> Result<Vec<IssueComment>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    list_issue_comments_impl(&conn, &issue_id).map_err(Into::into)
}

#[tauri::command(rename = "opensymphony:list-issue-run-attempts")]
pub fn list_issue_run_attempts(
    db: State<Db>,
    issue_id: String,
) -> Result<Vec<IssueDetailRunAttempt>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    list_issue_run_attempts_impl(&conn, &issue_id).map_err(Into::into)
}

#[tauri::command(rename = "opensymphony:list-session-events")]
pub fn list_session_events(
    db: State<Db>,
    issue_id: String,
) -> Result<Vec<SessionEvent>, String> {
    let conn = db.conn().map_err(|err| err.to_string())?;
    list_session_events_impl(&conn, &issue_id).map_err(Into::into)
}

fn get_issue_header_impl(conn: &Connection, issue_id: &str) -> DbResult<IssueHeader> {
    let repo = IssueRepo::new(conn);
    repo.get(issue_id)?
        .map(IssueHeader::from)
        .ok_or_else(|| crate::db::error::DbError::NotFound(format!("issue {issue_id}")))
}

fn list_issue_comments_impl(conn: &Connection, issue_id: &str) -> DbResult<Vec<IssueComment>> {
    CommentRepo::new(conn).list_by_issue(issue_id)
}

fn list_issue_run_attempts_impl(
    conn: &Connection,
    issue_id: &str,
) -> DbResult<Vec<IssueDetailRunAttempt>> {
    let attempts = RunAttemptRepo::new(conn).list_by_issue(issue_id)?;
    Ok(attempts.into_iter().map(IssueDetailRunAttempt::from).collect())
}

fn list_session_events_impl(conn: &Connection, issue_id: &str) -> DbResult<Vec<SessionEvent>> {
    SessionEventRepo::new(conn).list_by_issue(issue_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repos::comment::CommentRepo;
    use crate::db::test_helpers::{open_test_db, seed_issue_with_session, seed_minimal_project};
    use crate::types::BoardColumnId;

    #[test]
    fn db_issue_reads_return_seeded_data() {
        let conn = open_test_db().expect("open test db");
        let fixtures = seed_minimal_project(&conn).expect("seed project");
        CommentRepo::new(&conn)
            .append(&fixtures.backlog_issue_id, "looks good", Some("operator"))
            .expect("append comment");

        let session_fixtures = seed_issue_with_session(&conn).expect("seed session");

        let header = get_issue_header_impl(&conn, &fixtures.backlog_issue_id)
            .expect("get issue header");
        assert_eq!(header.identifier, "SYM-1");
        assert_eq!(header.board_column, BoardColumnId::Backlog);

        let comments = list_issue_comments_impl(&conn, &fixtures.backlog_issue_id)
            .expect("list comments");
        assert_eq!(comments.len(), 1);
        assert_eq!(comments[0].body, "looks good");

        let attempts =
            list_issue_run_attempts_impl(&conn, &session_fixtures.issue_id).expect("list attempts");
        assert_eq!(attempts.len(), 1);
        assert_eq!(attempts[0].attempt_number, 1);

        let events = list_session_events_impl(&conn, &session_fixtures.issue_id)
            .expect("list session events");
        assert_eq!(events.len(), 3);
    }
}

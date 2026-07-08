use std::collections::HashSet;
use std::sync::Arc;

use chrono::{Duration as ChronoDuration, Utc};

use crate::acp::types::{AcpAdapter, RuntimeSessionRecord, RuntimeSessionStatus, StartRuntimeSessionInput};
use crate::db::error::DbResult;
use crate::db::repos::agent_session::AgentSessionRepo;
use crate::db::repos::comment::CommentRepo;
use crate::db::repos::issue::IssueRepo;
use crate::db::repos::retry_queue::RetryQueueRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::acp::dispatch::resolve_dispatch_agent;
use crate::acp::PauseGate;
use crate::types::{BoardColumnId, Issue, Project, RetryQueueEntry};

use super::audit::{self, action};
use super::pause::PauseGateRegistry;
use super::runtime::Runtime;
use super::workspace::WorkspaceManager;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DispatchedRun {
    pub issue_id: String,
    pub identifier: String,
    pub run_attempt_id: String,
    pub attempt_number: i32,
    pub session_id: String,
}

fn retry_delay_ms(backoff_ms: i32, attempt_number: i32) -> i64 {
    let exp = attempt_number.saturating_sub(1).max(0) as u32;
    let factor = 1i64.checked_shl(exp).unwrap_or(i64::MAX);
    (backoff_ms as i64).saturating_mul(factor)
}

pub(crate) fn schedule_retry(
    repo: &RetryQueueRepo<'_>,
    project: &Project,
    issue_id: &str,
    next_attempt_number: i32,
    error_message: Option<&str>,
) -> DbResult<()> {
    if next_attempt_number > project.retry_max_attempts {
        return Ok(());
    }

    let delay_ms = retry_delay_ms(project.retry_backoff_ms, next_attempt_number);
    let due_at = (Utc::now() + ChronoDuration::milliseconds(delay_ms))
        .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);

    repo.upsert(issue_id, next_attempt_number, &due_at, error_message)?;
    Ok(())
}

pub(crate) fn pop_due_retries(
    repo: &RetryQueueRepo<'_>,
    project_id: &str,
    now_iso: &str,
) -> DbResult<Vec<RetryQueueEntry>> {
    let due = repo.list_due_for_project(project_id, now_iso)?;
    for entry in &due {
        repo.remove(&entry.issue_id)?;
    }
    Ok(due)
}

fn is_dispatch_eligible(column: BoardColumnId) -> bool {
    matches!(column, BoardColumnId::Backlog | BoardColumnId::InProgress)
}

pub(crate) fn reconcile_running_attempts(
    attempts: &RunAttemptRepo<'_>,
    issues: &IssueRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    runtime: &mut Runtime,
    workspaces: &WorkspaceManager,
    project_id: &str,
) -> DbResult<()> {
    for attempt in attempts.list_running(project_id)? {
        let Some(issue) = issues.get(&attempt.issue_id)? else {
            attempts.finish(&attempt.id, "cancelled", Some("reconciled_missing_issue"))?;
            retries.remove(&attempt.issue_id)?;
            runtime.release_workspace(&attempt.id, workspaces)?;
            continue;
        };

        if is_dispatch_eligible(issue.board_column) {
            continue;
        }

        let reason = format!("reconciled_out_of_scope:{}", issue.board_column.as_str());
        attempts.finish(&attempt.id, "cancelled", Some(&reason))?;
        retries.remove(&attempt.issue_id)?;
        runtime.release_workspace(&attempt.id, workspaces)?;
    }
    Ok(())
}

pub(crate) fn run_poll_cycle(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    issues: &IssueRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    workspaces: &WorkspaceManager,
    runtime: &mut Runtime,
    project: &Project,
    now_iso: &str,
    pause_gates: &PauseGateRegistry,
) -> DbResult<Vec<DispatchedRun>> {
    let running = attempts.list_running(&project.id)?;
    let mut running_issue_ids: HashSet<String> =
        running.iter().map(|attempt| attempt.issue_id.clone()).collect();
    let available_slots = (project.max_concurrency - running.len() as i32).max(0);
    let mut dispatched = Vec::new();

    for retry in pop_due_retries(retries, &project.id, now_iso)? {
        if running_issue_ids.contains(&retry.issue_id) {
            continue;
        }
        let run = dispatch_attempt(
            conn,
            adapter,
            attempts,
            issues,
            sessions,
            workspaces,
            runtime,
            project,
            &retry.issue_id,
            retry.attempt_number,
            now_iso,
            pause_gates,
        )?;
        running_issue_ids.insert(retry.issue_id);
        dispatched.push(run);
    }

    let remaining_slots = (available_slots - dispatched.len() as i32).max(0) as usize;
    for candidate in issues
        .list_candidates(&project.id)?
        .into_iter()
        .take(remaining_slots)
    {
        if running_issue_ids.contains(&candidate.issue_id) {
            continue;
        }

        let attempt_number = next_attempt_number(attempts, &candidate.issue_id)?;
        let run = dispatch_attempt(
            conn,
            adapter,
            attempts,
            issues,
            sessions,
            workspaces,
            runtime,
            project,
            &candidate.issue_id,
            attempt_number,
            now_iso,
            pause_gates,
        )?;
        running_issue_ids.insert(candidate.issue_id);
        dispatched.push(run);
    }

    Ok(dispatched)
}

pub(crate) fn poll_running_sessions(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    issues: &IssueRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    workspaces: &WorkspaceManager,
    runtime: &mut Runtime,
    pause_gates: &PauseGateRegistry,
    project: &Project,
    now_iso: &str,
) -> DbResult<u32> {
    let mut adapter_ids = Vec::new();
    let mut db_session_ids = Vec::new();

    for attempt in attempts.list_running(&project.id)? {
        for session in sessions.list_by_run_attempt(&attempt.id)? {
            if session.status != "running" {
                continue;
            }
            adapter_ids.push(session.id.clone());
            db_session_ids.push(session.id);
        }
    }

    if adapter_ids.is_empty() {
        return Ok(0);
    }

    let mut finished = 0u32;
    for record in adapter.poll_sessions(now_iso, &adapter_ids) {
        if record.status == RuntimeSessionStatus::Running {
            continue;
        }
        let Some(db_session_id) = db_session_ids
            .iter()
            .zip(adapter_ids.iter())
            .find_map(|(db_id, adapter_id)| {
                (adapter_id == &record.session_id).then(|| db_id.clone())
            })
        else {
            continue;
        };

        sync_session_outcome(
            conn,
            adapter,
            &record,
            &db_session_id,
            attempts,
            issues,
            sessions,
            retries,
            workspaces,
            runtime,
            pause_gates,
            project,
            now_iso,
        )?;
        finished = finished.saturating_add(1);
    }

    Ok(finished)
}

fn sync_session_outcome(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    record: &RuntimeSessionRecord,
    db_session_id: &str,
    attempts: &RunAttemptRepo<'_>,
    issues: &IssueRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    workspaces: &WorkspaceManager,
    runtime: &mut Runtime,
    pause_gates: &PauseGateRegistry,
    project: &Project,
    now_iso: &str,
) -> DbResult<()> {
    let finished_at = record
        .finished_at
        .as_deref()
        .unwrap_or(now_iso);

    match record.status {
        RuntimeSessionStatus::Running => {}
        RuntimeSessionStatus::Succeeded => {
            if let Some(message) = adapter.get_last_agent_message(db_session_id) {
                let message = message.trim();
                if !message.is_empty() {
                    CommentRepo::new(conn).append(
                        &record.issue_id,
                        message,
                        record.agent_name.as_deref(),
                    )?;
                }
            }
            sessions.finish(db_session_id, "succeeded", finished_at)?;
            attempts.finish(&record.run_attempt_id, "succeeded", None)?;
            issues.transition_column(&record.issue_id, BoardColumnId::Review)?;
            runtime.release_workspace(&record.run_attempt_id, workspaces)?;
            pause_gates.remove(db_session_id);
            audit::log(
                conn,
                &project.id,
                action::ATTEMPT_SUCCEEDED,
                Some(&record.issue_id),
            )?;
        }
        RuntimeSessionStatus::Failed => {
            let error = record.error_message.as_deref();
            sessions.finish(db_session_id, "failed", finished_at)?;
            attempts.finish(&record.run_attempt_id, "failed", error)?;
            schedule_retry(
                retries,
                project,
                &record.issue_id,
                record.attempt_number as i32 + 1,
                error,
            )?;
            runtime.release_workspace(&record.run_attempt_id, workspaces)?;
            pause_gates.remove(db_session_id);
            audit::log(
                conn,
                &project.id,
                action::ATTEMPT_FAILED,
                Some(&record.issue_id),
            )?;
        }
        RuntimeSessionStatus::Cancelled => {
            let error = record.error_message.as_deref();
            sessions.finish(db_session_id, "cancelled", finished_at)?;
            attempts.finish(&record.run_attempt_id, "cancelled", error)?;
            retries.remove(&record.issue_id)?;
            runtime.release_workspace(&record.run_attempt_id, workspaces)?;
            pause_gates.remove(db_session_id);
            audit::log(
                conn,
                &project.id,
                action::ATTEMPT_CANCELLED,
                Some(&record.issue_id),
            )?;
        }
    }

    Ok(())
}

const CANCEL_BY_OPERATOR: &str = "cancelled_by_operator";

pub(crate) fn cancel_run_attempt(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    workspaces: &WorkspaceManager,
    runtime: &mut Runtime,
    pause_gates: &PauseGateRegistry,
    project: &Project,
    run_attempt_id: &str,
    now_iso: &str,
) -> DbResult<()> {
    let attempt = attempts
        .list_running(&project.id)?
        .into_iter()
        .find(|entry| entry.id == run_attempt_id)
        .ok_or_else(|| {
            crate::db::error::DbError::NotFound(format!("run attempt {run_attempt_id}"))
        })?;

    let running_sessions: Vec<_> = sessions
        .list_by_run_attempt(run_attempt_id)?
        .into_iter()
        .filter(|session| session.status == "running")
        .collect();

    for session in &running_sessions {
        let _ = adapter.cancel_session(&session.id, now_iso, CANCEL_BY_OPERATOR);
        sessions.finish(&session.id, "cancelled", now_iso)?;
        pause_gates.remove(&session.id);
    }

    attempts.finish(run_attempt_id, "cancelled", Some(CANCEL_BY_OPERATOR))?;
    retries.remove(&attempt.issue_id)?;
    runtime.release_workspace(run_attempt_id, workspaces)?;
    audit::log(
        conn,
        &project.id,
        action::ATTEMPT_CANCELLED,
        Some(&attempt.issue_id),
    )?;

    Ok(())
}

fn next_attempt_number(attempts: &RunAttemptRepo<'_>, issue_id: &str) -> DbResult<i32> {
    Ok(attempts
        .list_by_issue(issue_id)?
        .first()
        .map(|attempt| attempt.attempt_number + 1)
        .unwrap_or(1))
}

fn dispatch_attempt(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    issues: &IssueRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    workspaces: &WorkspaceManager,
    runtime: &mut Runtime,
    project: &Project,
    issue_id: &str,
    attempt_number: i32,
    now_iso: &str,
    pause_gates: &PauseGateRegistry,
) -> DbResult<DispatchedRun> {
    let issue = issues
        .get(issue_id)?
        .ok_or_else(|| crate::db::error::DbError::NotFound(format!("issue {issue_id}")))?;

    let attempt = attempts.create_with_attempt_number(issue_id, attempt_number)?;
    issues.transition_column(issue_id, BoardColumnId::InProgress)?;
    let workspace_path = workspaces.ensure_workspace(&project.id, issue_id)?;
    runtime.track_workspace(&attempt.id, issue_id);

    let session = sessions.create(&attempt.id, "acp")?;
    let dispatch_agent = resolve_dispatch_agent(conn, &project.id)?;
    let pause_gate = pause_gates.create_gate();
    let record = adapter.start_session(build_session_input(
        project,
        &issue,
        &attempt.id,
        &session.id,
        attempt_number,
        now_iso,
        workspace_path.to_string_lossy().into_owned(),
        dispatch_agent.as_ref().map(|agent| agent.acp_command.clone()),
        dispatch_agent.map(|agent| agent.name),
        pause_gate.clone(),
    ));

    pause_gates.register(&session.id, pause_gate);
    debug_assert_eq!(record.session_id, session.id);
    audit::log(
        conn,
        &project.id,
        action::ATTEMPT_DISPATCHED,
        Some(issue_id),
    )?;

    Ok(DispatchedRun {
        issue_id: issue.id,
        identifier: issue.identifier,
        run_attempt_id: attempt.id,
        attempt_number,
        session_id: record.session_id,
    })
}

fn build_session_input(
    project: &Project,
    issue: &Issue,
    run_attempt_id: &str,
    agent_session_id: &str,
    attempt_number: i32,
    now_iso: &str,
    workspace_path: String,
    acp_command: Option<String>,
    agent_name: Option<String>,
    pause_gate: Arc<dyn PauseGate>,
) -> StartRuntimeSessionInput {
    StartRuntimeSessionInput {
        agent_session_id: agent_session_id.into(),
        run_attempt_id: run_attempt_id.into(),
        issue_id: issue.id.clone(),
        identifier: issue.identifier.clone(),
        title: issue.title.clone(),
        description: issue.description.clone(),
        prompt_template: project.prompt_template.clone(),
        attempt_number: attempt_number as u32,
        started_at: now_iso.into(),
        workspace_path,
        acp_command,
        agent_name,
        pause_gate,
    }
}

use std::collections::HashSet;
use std::sync::Arc;

use chrono::{Duration as ChronoDuration, Utc};

use crate::acp::dispatch::resolve_dispatch_for_task;
use crate::acp::types::{AcpAdapter, RuntimeSessionRecord, RuntimeSessionStatus, StartRuntimeSessionInput};
use crate::acp::PauseGate;
use crate::db::error::DbResult;
use crate::db::repos::agent_session::AgentSessionRepo;
use crate::db::repos::comment::CommentRepo;
use crate::db::repos::task::TaskRepo;
use crate::db::repos::retry_queue::RetryQueueRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::types::{BoardColumnId, Task, Project, RuntimeSessionPhase};
use crate::utils::retry_delay_ms;

use super::pause::PauseGateRegistry;
use super::runtime_events::RuntimeEventEmitter;
use super::workspace::{resolve_dispatch_cwd, WorkspaceManager};

const CANCEL_BY_OPERATOR: &str = "cancelled_by_operator";
const ORPHANED_SESSION: &str = "orphaned_session";

fn is_dispatch_eligible(column: BoardColumnId) -> bool {
    matches!(column, BoardColumnId::Backlog | BoardColumnId::InProgress)
}

pub(crate) fn task_eligible_for_dispatch(
    tasks: &TaskRepo<'_>,
    task_id: &str,
) -> DbResult<bool> {
    let Some(task) = tasks.get(task_id)? else {
        return Ok(false);
    };
    Ok(is_dispatch_eligible(task.board_column))
}

fn dispatch_slot_limit(max_concurrency: i32, running_count: usize) -> usize {
    (max_concurrency - running_count as i32).max(0) as usize
}

pub(crate) fn schedule_retry(
    repo: &RetryQueueRepo<'_>,
    project: &Project,
    task_id: &str,
    next_attempt_number: i32,
    error_message: Option<&str>,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    if next_attempt_number > project.retry_max_attempts {
        return Ok(());
    }

    let delay_ms = retry_delay_ms(project.retry_backoff_ms, next_attempt_number);
    let due_at = (Utc::now() + ChronoDuration::milliseconds(delay_ms))
        .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);

    repo.upsert(task_id, next_attempt_number, &due_at, error_message)?;
    emitter.retry_changed(&project.id);
    Ok(())
}

pub(crate) fn cancel_retry(
    repo: &RetryQueueRepo<'_>,
    project_id: &str,
    task_id: &str,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    repo.remove(task_id)?;
    emitter.retry_changed(project_id);
    Ok(())
}

pub(crate) fn dispatch_retry(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    tasks: &TaskRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    workspaces: &WorkspaceManager,
    project: &Project,
    task_id: &str,
    attempt_number: i32,
    pause_gates: &PauseGateRegistry,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    let running = attempts.list_running(&project.id)?;
    if running.iter().any(|attempt| attempt.task_id == task_id) {
        return Ok(());
    }
    if dispatch_slot_limit(project.max_concurrency, running.len()) == 0 {
        return Ok(());
    }
    if !task_eligible_for_dispatch(tasks, task_id)? {
        log::info!("retry skipped for task {task_id}: board column is not dispatch eligible");
        return Ok(());
    }

    if dispatch_attempt(
        conn,
        adapter,
        attempts,
        tasks,
        sessions,
        workspaces,
        project,
        task_id,
        attempt_number,
        pause_gates,
        emitter,
    )? {
        emitter.running_changed(&project.id);
    }
    Ok(())
}

pub(crate) fn dispatch_due_retries(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    tasks: &TaskRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    workspaces: &WorkspaceManager,
    project: &Project,
    now_iso: &str,
    pause_gates: &PauseGateRegistry,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    for entry in retries.list_due_for_project(&project.id, now_iso)? {
        retries.take(&entry.task_id)?;
        dispatch_retry(
            conn,
            adapter,
            attempts,
            tasks,
            sessions,
            workspaces,
            project,
            &entry.task_id,
            entry.attempt_number,
            pause_gates,
            emitter,
        )?;
    }
    Ok(())
}

pub(crate) fn try_dispatch(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    tasks: &TaskRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    workspaces: &WorkspaceManager,
    project: &Project,
    pause_gates: &PauseGateRegistry,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    let running = attempts.list_running(&project.id)?;
    let mut running_task_ids: HashSet<String> =
        running.iter().map(|attempt| attempt.task_id.clone()).collect();
    let available_slots = dispatch_slot_limit(project.max_concurrency, running.len());
    let mut dispatched = false;

    for candidate in tasks
        .list_candidates(&project.id)?
        .into_iter()
        .take(available_slots)
    {
        if running_task_ids.contains(&candidate.task_id) {
            continue;
        }

        let attempt_number = next_attempt_number(attempts, &candidate.task_id)?;
        if dispatch_attempt(
            conn,
            adapter,
            attempts,
            tasks,
            sessions,
            workspaces,
            project,
            &candidate.task_id,
            attempt_number,
            pause_gates,
            emitter,
        )? {
            running_task_ids.insert(candidate.task_id);
            dispatched = true;
        }
    }

    if dispatched {
        emitter.running_changed(&project.id);
    }
    Ok(())
}

pub(crate) fn reconcile_running_attempts(
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    tasks: &TaskRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    pause_gates: &PauseGateRegistry,
    project: &Project,
    task_id: Option<&str>,
    now_iso: &str,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    for attempt in attempts.list_running(&project.id)? {
        if task_id.is_some_and(|id| attempt.task_id != id) {
            continue;
        }

        let Some(task) = tasks.get(&attempt.task_id)? else {
            cancel_out_of_scope_attempt(
                adapter,
                attempts,
                sessions,
                retries,
                pause_gates,
                project,
                &attempt,
                "reconciled_missing_task",
                now_iso,
                emitter,
            )?;
            continue;
        };

        if is_dispatch_eligible(task.board_column) {
            continue;
        }

        let reason = format!("reconciled_out_of_scope:{}", task.board_column.as_str());
        cancel_out_of_scope_attempt(
            adapter,
            attempts,
            sessions,
            retries,
            pause_gates,
            project,
            &attempt,
            &reason,
            now_iso,
            emitter,
        )?;
    }
    Ok(())
}

fn cancel_out_of_scope_attempt(
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    pause_gates: &PauseGateRegistry,
    project: &Project,
    attempt: &crate::types::RunAttempt,
    reason: &str,
    now_iso: &str,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    for session in sessions.list_by_run_attempt(&attempt.id)? {
        if session.status != "running" {
            continue;
        }
        let _ = adapter.cancel_session(&session.id, now_iso, reason);
        finish_session_if_running(sessions, &session.id, "cancelled", now_iso)?;
        pause_gates.remove(&session.id);
    }

    if attempt.status == "running" {
        attempts.finish(&attempt.id, "cancelled", Some(reason))?;
    }
    cancel_retry(retries, &project.id, &attempt.task_id, emitter)?;
    emitter.running_changed(&project.id);
    emitter.finished_changed(&project.id);
    Ok(())
}

pub(crate) fn sweep_orphan_sessions(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    tasks: &TaskRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    pause_gates: &PauseGateRegistry,
    project: &Project,
    now_iso: &str,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    for attempt in attempts.list_running(&project.id)? {
        for session in sessions.list_by_run_attempt(&attempt.id)? {
            if session.status != "running" {
                continue;
            }

            let session_id = session.id.clone();
            adapter.poll_sessions(now_iso, std::slice::from_ref(&session_id));

            match adapter.get_session_phase(&session_id) {
                None => {
                    handle_orphan_session(
                        conn,
                        adapter,
                        attempts,
                        sessions,
                        retries,
                        pause_gates,
                        project,
                        &attempt,
                        &session_id,
                        now_iso,
                        emitter,
                    )?;
                }
                Some(RuntimeSessionPhase::Terminal) => {
                    let records = adapter.poll_sessions(now_iso, std::slice::from_ref(&session_id));
                    if let Some(record) = records.first() {
                        sync_session_outcome(
                            conn,
                            adapter,
                            record,
                            attempts,
                            tasks,
                            sessions,
                            retries,
                            pause_gates,
                            project,
                            now_iso,
                            emitter,
                        )?;
                    }
                }
                Some(_) => {}
            }
        }
    }
    Ok(())
}

fn handle_orphan_session(
    _conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    pause_gates: &PauseGateRegistry,
    project: &Project,
    attempt: &crate::types::RunAttempt,
    session_id: &str,
    now_iso: &str,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    if attempt.status != "running" {
        return Ok(());
    }

    let _ = adapter.cancel_session(session_id, now_iso, ORPHANED_SESSION);
    finish_session_if_running(sessions, session_id, "failed", now_iso)?;
    attempts.finish(&attempt.id, "failed", Some(ORPHANED_SESSION))?;
    schedule_retry(
        retries,
        project,
        &attempt.task_id,
        attempt.attempt_number + 1,
        Some(ORPHANED_SESSION),
        emitter,
    )?;
    pause_gates.remove(session_id);
    emitter.running_changed(&project.id);
    emitter.finished_changed(&project.id);
    Ok(())
}

pub(crate) fn sync_session_outcome(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    record: &RuntimeSessionRecord,
    attempts: &RunAttemptRepo<'_>,
    tasks: &TaskRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    pause_gates: &PauseGateRegistry,
    project: &Project,
    now_iso: &str,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    if record.status == RuntimeSessionStatus::Running {
        return Ok(());
    }

    let Some(attempt) = attempts.get(&record.run_attempt_id)? else {
        return Ok(());
    };
    if attempt.status != "running" {
        return Ok(());
    }

    let session_id = &record.session_id;
    let finished_at = record.finished_at.as_deref().unwrap_or(now_iso);

    match record.status {
        RuntimeSessionStatus::Running => {}
        RuntimeSessionStatus::Succeeded => {
            if let Some(message) = adapter.get_last_agent_message(session_id) {
                let message = message.trim();
                if !message.is_empty() {
                    CommentRepo::new(conn).append(
                        &record.task_id,
                        message,
                        record.agent_name.as_deref(),
                    )?;
                }
            }
            finish_session_if_running(sessions, session_id, "succeeded", finished_at)?;
            attempts.finish(&record.run_attempt_id, "succeeded", None)?;
            tasks.transition_column(&record.task_id, BoardColumnId::Review)?;
            pause_gates.remove(session_id);
            emitter.running_changed(&project.id);
            emitter.finished_changed(&project.id);
        }
        RuntimeSessionStatus::Failed => {
            let error = record.error_message.as_deref();
            finish_session_if_running(sessions, session_id, "failed", finished_at)?;
            attempts.finish(&record.run_attempt_id, "failed", error)?;
            schedule_retry(
                retries,
                project,
                &record.task_id,
                record.attempt_number as i32 + 1,
                error,
                emitter,
            )?;
            pause_gates.remove(session_id);
            emitter.running_changed(&project.id);
            emitter.finished_changed(&project.id);
        }
        RuntimeSessionStatus::Cancelled => {
            let error = record.error_message.as_deref();
            finish_session_if_running(sessions, session_id, "cancelled", finished_at)?;
            attempts.finish(&record.run_attempt_id, "cancelled", error)?;
            cancel_retry(retries, &project.id, &record.task_id, emitter)?;
            pause_gates.remove(session_id);
            emitter.running_changed(&project.id);
            emitter.finished_changed(&project.id);
        }
    }

    Ok(())
}

fn finish_session_if_running(
    sessions: &AgentSessionRepo<'_>,
    session_id: &str,
    status: &str,
    finished_at: &str,
) -> DbResult<()> {
    let Some(session) = sessions.get(session_id)? else {
        return Ok(());
    };
    if session.status != "running" {
        return Ok(());
    }
    sessions.finish(session_id, status, finished_at)?;
    Ok(())
}

pub(crate) fn cancel_run_attempt(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    retries: &RetryQueueRepo<'_>,
    pause_gates: &PauseGateRegistry,
    project: &Project,
    run_attempt_id: &str,
    now_iso: &str,
    emitter: &RuntimeEventEmitter,
) -> DbResult<()> {
    let attempt = attempts
        .list_running(&project.id)?
        .into_iter()
        .find(|entry| entry.id == run_attempt_id)
        .ok_or_else(|| {
            crate::db::error::DbError::NotFound(format!("run attempt {run_attempt_id}"))
        })?;

    for session in sessions
        .list_by_run_attempt(run_attempt_id)?
        .into_iter()
        .filter(|session| session.status == "running")
    {
        let _ = adapter.cancel_session(&session.id, now_iso, CANCEL_BY_OPERATOR);
        finish_session_if_running(sessions, &session.id, "cancelled", now_iso)?;
        pause_gates.remove(&session.id);
    }

    attempts.finish(run_attempt_id, "cancelled", Some(CANCEL_BY_OPERATOR))?;
    cancel_retry(retries, &project.id, &attempt.task_id, emitter)?;
    emitter.running_changed(&project.id);
    emitter.finished_changed(&project.id);
    let _ = conn;
    Ok(())
}

fn next_attempt_number(attempts: &RunAttemptRepo<'_>, task_id: &str) -> DbResult<i32> {
    Ok(attempts
        .list_by_task(task_id)?
        .first()
        .map(|attempt| attempt.attempt_number + 1)
        .unwrap_or(1))
}

fn dispatch_attempt(
    conn: &rusqlite::Connection,
    adapter: &dyn AcpAdapter,
    attempts: &RunAttemptRepo<'_>,
    tasks: &TaskRepo<'_>,
    sessions: &AgentSessionRepo<'_>,
    workspaces: &WorkspaceManager,
    project: &Project,
    task_id: &str,
    attempt_number: i32,
    pause_gates: &PauseGateRegistry,
    emitter: &RuntimeEventEmitter,
) -> DbResult<bool> {
    let task = tasks
        .get(task_id)?
        .ok_or_else(|| crate::db::error::DbError::NotFound(format!("task {task_id}")))?;

    let Some(dispatch) = resolve_dispatch_for_task(conn, task_id)? else {
        return Ok(false);
    };

    let Some(workspace_path) = resolve_dispatch_cwd(workspaces, project, task_id)? else {
        return Ok(false);
    };

    let attempt = attempts.create_with_attempt_number(task_id, attempt_number)?;
    tasks.transition_column(task_id, BoardColumnId::InProgress)?;

    let session = sessions.create(&attempt.id, "acp")?;
    let pause_gate = pause_gates.create_gate();
    let record = adapter.start_session(build_session_input(
        project,
        &task,
        &attempt.id,
        &session.id,
        attempt_number,
        workspace_path.to_string_lossy().into_owned(),
        Some(dispatch.acp_command),
        Some(dispatch.label),
        pause_gate.clone(),
    ));

    pause_gates.register(&session.id, pause_gate);
    debug_assert_eq!(record.session_id, session.id);
    let _ = emitter;
    let _ = conn;
    Ok(true)
}

fn build_session_input(
    project: &Project,
    task: &Task,
    run_attempt_id: &str,
    agent_session_id: &str,
    attempt_number: i32,
    workspace_path: String,
    acp_command: Option<String>,
    agent_name: Option<String>,
    pause_gate: Arc<dyn PauseGate>,
) -> StartRuntimeSessionInput {
    StartRuntimeSessionInput {
        project_id: project.id.clone(),
        agent_session_id: agent_session_id.into(),
        run_attempt_id: run_attempt_id.into(),
        task_id: task.id.clone(),
        title: task.title.clone(),
        description: task.description.clone(),
        prompt_template: project.prompt_template.clone(),
        attempt_number: attempt_number as u32,
        workspace_path,
        acp_command,
        agent_name,
        pause_gate,
        auto_approve_permissions: task.auto_approve_permissions,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::types::{AcpAdapter, RuntimeSessionRecord, RuntimeSessionStatus, StartRuntimeSessionInput};
    use crate::db::fixtures::{open_test_db, seed_minimal_project};
    use crate::db::repos::agent_session::AgentSessionRepo;
    use crate::db::repos::task::TaskRepo;
    use crate::db::repos::project::ProjectRepo;
    use crate::db::repos::retry_queue::RetryQueueRepo;
    use crate::db::repos::run_attempt::RunAttemptRepo;
    use crate::orchestrator::pause::PauseGateRegistry;
    use crate::orchestrator::workspace::WorkspaceManager;
    use crate::types::BoardColumnId;

    struct NoopAdapter;

    impl AcpAdapter for NoopAdapter {
        fn start_session(&self, input: StartRuntimeSessionInput) -> RuntimeSessionRecord {
            RuntimeSessionRecord {
                session_id: input.agent_session_id,
                run_attempt_id: input.run_attempt_id,
                task_id: input.task_id,
                attempt_number: input.attempt_number,
                status: RuntimeSessionStatus::Running,
                finished_at: None,
                error_message: None,
                agent_name: input.agent_name,
            }
        }

        fn poll_sessions(&self, _now_iso: &str, _session_ids: &[String]) -> Vec<RuntimeSessionRecord> {
            Vec::new()
        }

        fn cancel_session(
            &self,
            session_id: &str,
            now_iso: &str,
            reason: &str,
        ) -> Option<RuntimeSessionRecord> {
            Some(RuntimeSessionRecord {
                session_id: session_id.to_string(),
                run_attempt_id: String::new(),
                task_id: String::new(),
                attempt_number: 0,
                status: RuntimeSessionStatus::Cancelled,
                finished_at: Some(now_iso.to_string()),
                error_message: Some(reason.to_string()),
                agent_name: None,
            })
        }

        fn get_session_phase(&self, _session_id: &str) -> Option<RuntimeSessionPhase> {
            None
        }

        fn get_last_agent_message(&self, _session_id: &str) -> Option<String> {
            None
        }

        fn is_session_paused(&self, _session_id: &str) -> bool {
            false
        }
    }

    fn noop_emitter() -> RuntimeEventEmitter {
        RuntimeEventEmitter::noop()
    }

    fn load_project(conn: &rusqlite::Connection, project_id: &str) -> Project {
        ProjectRepo::new(conn)
            .get(project_id)
            .expect("get project")
            .expect("project exists")
    }

    #[test]
    fn try_dispatch_respects_max_concurrency_when_slots_full() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        conn.execute(
            "UPDATE projects SET max_concurrency = 1 WHERE id = ?1",
            [&fixtures.project_id],
        )
        .expect("set max concurrency");

        let tasks = TaskRepo::new(&conn);
        let attempts = RunAttemptRepo::new(&conn);
        let running_task = tasks
            .create(
                &fixtures.project_id,
                "Running task",
                None,
                Some("hermes"),
                None,
                &[],
            )
            .expect("create running task");
        attempts
            .create_with_attempt_number(&running_task.id, 1)
            .expect("create running attempt");

        tasks
            .create(
                &fixtures.project_id,
                "Backlog task",
                None,
                Some("hermes"),
                None,
                &[],
            )
            .expect("create backlog task");

        let project = load_project(&conn, &fixtures.project_id);
        try_dispatch(
            &conn,
            &NoopAdapter,
            &attempts,
            &tasks,
            &AgentSessionRepo::new(&conn),
            &WorkspaceManager::new("/tmp/opensymphony-test-workspaces"),
            &project,
            &PauseGateRegistry::default(),
            &noop_emitter(),
        )
        .expect("try dispatch");

        assert_eq!(
            attempts
                .list_running(&fixtures.project_id)
                .expect("list running")
                .len(),
            1
        );
    }

    #[test]
    fn dispatch_retry_skips_ineligible_board_column() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        let tasks = TaskRepo::new(&conn);
        let attempts = RunAttemptRepo::new(&conn);

        let task = tasks
            .create(
                &fixtures.project_id,
                "Review task",
                None,
                Some("hermes"),
                None,
                &[],
            )
            .expect("create task");
        tasks
            .transition_column(&task.id, BoardColumnId::Review)
            .expect("transition to review");

        let project = load_project(&conn, &fixtures.project_id);
        dispatch_retry(
            &conn,
            &NoopAdapter,
            &attempts,
            &tasks,
            &AgentSessionRepo::new(&conn),
            &WorkspaceManager::new("/tmp/opensymphony-test-workspaces"),
            &project,
            &task.id,
            2,
            &PauseGateRegistry::default(),
            &noop_emitter(),
        )
        .expect("dispatch retry");

        assert!(
            attempts
                .list_running(&fixtures.project_id)
                .expect("list running")
                .is_empty()
        );
    }

    #[test]
    fn sync_session_outcome_is_idempotent_when_attempt_already_finished() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        let tasks = TaskRepo::new(&conn);
        let attempts = RunAttemptRepo::new(&conn);
        let sessions = AgentSessionRepo::new(&conn);
        let retries = RetryQueueRepo::new(&conn);

        let task = tasks
            .create(
                &fixtures.project_id,
                "In progress task",
                None,
                Some("hermes"),
                None,
                &[],
            )
            .expect("create task");
        tasks
            .transition_column(&task.id, BoardColumnId::InProgress)
            .expect("transition");
        let attempt = attempts
            .create_with_attempt_number(&task.id, 1)
            .expect("create attempt");
        attempts
            .finish(&attempt.id, "succeeded", None)
            .expect("finish attempt");

        let project = load_project(&conn, &fixtures.project_id);
        let record = RuntimeSessionRecord {
            session_id: "session-1".into(),
            run_attempt_id: attempt.id.clone(),
            task_id: task.id.clone(),
            attempt_number: 1,
            status: RuntimeSessionStatus::Succeeded,
            finished_at: Some("2099-01-01T00:00:00+00:00".into()),
            error_message: None,
            agent_name: None,
        };

        sync_session_outcome(
            &conn,
            &NoopAdapter,
            &record,
            &attempts,
            &tasks,
            &sessions,
            &retries,
            &PauseGateRegistry::default(),
            &project,
            "2099-01-01T00:00:00+00:00",
            &noop_emitter(),
        )
        .expect("sync outcome");

        let finished_attempt = attempts
            .get(&attempt.id)
            .expect("get attempt")
            .expect("attempt exists");
        assert_eq!(finished_attempt.status, "succeeded");

        let current_task = tasks.get(&task.id).expect("get task").expect("task exists");
        assert_eq!(current_task.board_column, BoardColumnId::InProgress);
    }
}

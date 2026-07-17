use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use chrono::Utc;
use rusqlite::Connection;
use tauri::async_runtime::{JoinHandle, RuntimeHandle};
use tauri::AppHandle;
use tokio::sync::mpsc::Receiver;
use tokio::time::{self, MissedTickBehavior};

use crate::acp::types::AcpAdapter;
use crate::db::error::{DbError, DbResult};
use crate::db::repos::agent_session::AgentSessionRepo;
use crate::db::repos::task::TaskRepo;
use crate::db::repos::project::ProjectRepo;
use crate::db::repos::retry_queue::RetryQueueRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::db::Db;
use crate::types::{
    BoardColumnId, Task, Project, ProjectPatch, RuntimeRecentFinishedEntry, RuntimeRetryEntry,
    RuntimeRunningEntry, RuntimeStatus, ReviewStatus, RunAttemptStatus,
};

use super::events::OrchestratorEvent;
use super::pause::PauseGateRegistry;
use super::poll::{
    cancel_run_attempt, dispatch_due_retries, reconcile_running_attempts, sweep_orphan_sessions,
    sync_session_outcome, try_dispatch,
};
use super::runtime_events::RuntimeEventEmitter;
use super::workspace::{cleanup_done_workspaces, WorkspaceManager};
use super::WATCHDOG_INTERVAL_MS;

struct ProjectRuntime {
    config: Option<Project>,
    status: RuntimeStatus,
    timer: Option<JoinHandle<()>>,
}

impl ProjectRuntime {
    fn new() -> Self {
        Self {
            config: None,
            status: RuntimeStatus::Idle,
            timer: None,
        }
    }

    fn reload_config(&mut self, conn: &Connection, project_id: &str) -> DbResult<()> {
        self.config = Some(
            ProjectRepo::new(conn)
                .get(project_id)?
                .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?,
        );
        Ok(())
    }

    fn apply_orchestrator_status(&mut self, value: &str) {
        self.status = if value == "running" {
            RuntimeStatus::Running
        } else {
            RuntimeStatus::Idle
        };
    }

    fn set_timer(&mut self, handle: JoinHandle<()>) {
        if let Some(existing) = self.timer.take() {
            existing.abort();
        }
        self.timer = Some(handle);
    }

    fn stop_timer(&mut self) {
        if let Some(handle) = self.timer.take() {
            handle.abort();
        }
    }

    fn has_watchdog(&self) -> bool {
        self.timer.is_some()
    }
}

pub struct Manager {
    db: Arc<Db>,
    async_runtime: RuntimeHandle,
    adapter: Arc<dyn AcpAdapter>,
    workspaces: WorkspaceManager,
    pause_gates: PauseGateRegistry,
    self_handle: OnceLock<Arc<Mutex<Manager>>>,
    runtimes: HashMap<String, ProjectRuntime>,
    event_rx: Option<Receiver<OrchestratorEvent>>,
    app_handle: AppHandle,
}

impl Manager {
    pub fn new(
        db: Arc<Db>,
        async_runtime: RuntimeHandle,
        adapter: Arc<dyn AcpAdapter>,
        workspaces: WorkspaceManager,
        event_rx: Receiver<OrchestratorEvent>,
        app: AppHandle,
    ) -> Self {
        Self {
            db,
            async_runtime,
            adapter,
            workspaces,
            pause_gates: PauseGateRegistry::default(),
            self_handle: OnceLock::new(),
            runtimes: HashMap::new(),
            event_rx: Some(event_rx),
            app_handle: app,
        }
    }

    fn emitter(&self) -> RuntimeEventEmitter {
        RuntimeEventEmitter::new(self.app_handle.clone())
    }

    pub fn attach_handle(handle: &Arc<Mutex<Manager>>) {
        let (event_rx, db, async_runtime) = {
            let Ok(mut guard) = handle.lock() else {
                return;
            };
            let _ = guard.self_handle.set(Arc::clone(handle));
            (
                guard.event_rx.take(),
                Arc::clone(&guard.db),
                guard.async_runtime.clone(),
            )
        };

        let Some(mut event_rx) = event_rx else {
            return;
        };

        let manager = Arc::clone(handle);
        async_runtime.spawn(async move {
            while let Some(event) = event_rx.recv().await {
                let Ok(conn) = db.conn() else {
                    log::error!("orchestrator event consumer: db connection failed");
                    continue;
                };
                let Ok(mut guard) = manager.lock() else {
                    log::error!("orchestrator event consumer: manager lock poisoned");
                    break;
                };
                if let Err(err) = guard.handle_orchestrator_event(&conn, event) {
                    log::error!("orchestrator event handler failed: {err}");
                }
            }
            log::info!("orchestrator event consumer stopped");
        });
    }

    pub fn register_project(&mut self, project_id: impl Into<String>) {
        self.runtimes
            .entry(project_id.into())
            .or_insert_with(ProjectRuntime::new);
    }

    fn runtime(&self, project_id: &str) -> DbResult<&ProjectRuntime> {
        self.runtimes
            .get(project_id)
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))
    }

    fn runtime_mut(&mut self, project_id: &str) -> DbResult<&mut ProjectRuntime> {
        self.runtimes
            .get_mut(project_id)
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))
    }

    pub fn pause_run(&self, conn: &Connection, run_attempt_id: &str) -> DbResult<()> {
        let session_id = running_session_id(conn, run_attempt_id)?;
        self.pause_gates.pause(&session_id)
    }

    pub fn resume_run(&self, conn: &Connection, run_attempt_id: &str) -> DbResult<()> {
        let session_id = running_session_id(conn, run_attempt_id)?;
        self.pause_gates.resume(&session_id)
    }

    pub fn cancel_run(&mut self, conn: &Connection, run_attempt_id: &str) -> DbResult<()> {
        let attempt = RunAttemptRepo::new(conn)
            .get(run_attempt_id)?
            .ok_or_else(|| DbError::NotFound(format!("run attempt {run_attempt_id}")))?;
        let task = TaskRepo::new(conn)
            .get(&attempt.task_id)?
            .ok_or_else(|| DbError::NotFound(format!("task {}", attempt.task_id)))?;
        let project = ProjectRepo::new(conn)
            .get(&task.project_id)?
            .ok_or_else(|| DbError::NotFound(format!("project {}", task.project_id)))?;

        self.register_project(&project.id);
        cancel_run_attempt(
            conn,
            self.adapter.as_ref(),
            &RunAttemptRepo::new(conn),
            &AgentSessionRepo::new(conn),
            &RetryQueueRepo::new(conn),
            &self.pause_gates,
            &project,
            run_attempt_id,
            &Utc::now().to_rfc3339(),
            &self.emitter(),
        )
    }

    pub fn runtime_running(
        &self,
        conn: &Connection,
        project_id: &str,
    ) -> DbResult<Vec<RuntimeRunningEntry>> {
        let task_repo = TaskRepo::new(conn);
        let session_repo = AgentSessionRepo::new(conn);
        let attempts = RunAttemptRepo::new(conn).list_running(project_id)?;

        let mut entries = Vec::with_capacity(attempts.len());
        for attempt in attempts {
            let task = task_repo.get(&attempt.task_id)?;
            let (title, description, executor) = runtime_task_summary(task.as_ref());

            let running_session = session_repo
                .list_by_run_attempt(&attempt.id)?
                .into_iter()
                .find(|session| session.status == "running");

            let (phase, paused) = match running_session {
                Some(session) => {
                    let sid = session.id;
                    (
                        self.adapter.get_session_phase(&sid),
                        self.adapter.is_session_paused(&sid),
                    )
                }
                None => (None, false),
            };

            entries.push(RuntimeRunningEntry {
                run_attempt_id: attempt.id,
                task_id: attempt.task_id,
                title,
                description,
                executor,
                attempt_number: attempt.attempt_number as u32,
                started_at: attempt.started_at,
                phase,
                paused,
            });
        }
        Ok(entries)
    }

    pub fn runtime_retrying(
        &self,
        conn: &Connection,
        project_id: &str,
    ) -> DbResult<Vec<RuntimeRetryEntry>> {
        let task_repo = TaskRepo::new(conn);
        let retries = RetryQueueRepo::new(conn).list_for_project(project_id)?;

        Ok(retries
            .into_iter()
            .map(|entry| {
                let task = task_repo.get(&entry.task_id).ok().flatten();
                let (title, description, executor) = runtime_task_summary(task.as_ref());
                RuntimeRetryEntry {
                    task_id: entry.task_id,
                    title,
                    description,
                    executor,
                    attempt_number: entry.attempt_number as u32,
                    due_at: entry.due_at,
                    error_message: entry.error_message,
                }
            })
            .collect())
    }

    pub fn runtime_recent_finished(
        &self,
        conn: &Connection,
        project_id: &str,
        limit: i32,
    ) -> DbResult<Vec<RuntimeRecentFinishedEntry>> {
        let task_repo = TaskRepo::new(conn);
        let attempts = RunAttemptRepo::new(conn).list_recent_finished(project_id, limit)?;

        Ok(attempts
            .into_iter()
            .map(|attempt| {
                let task = task_repo.get(&attempt.task_id).ok().flatten();
                let (title, description, executor) = runtime_task_summary(task.as_ref());
                let review_status = task
                    .as_ref()
                    .and_then(|row| resolve_review_status(&attempt.status, row.board_column));

                RuntimeRecentFinishedEntry {
                    run_attempt_id: attempt.id,
                    task_id: attempt.task_id,
                    title,
                    description,
                    executor,
                    attempt_number: attempt.attempt_number as u32,
                    status: parse_run_attempt_status(&attempt.status),
                    finished_at: attempt.finished_at.unwrap_or_default(),
                    error_message: attempt.error_message,
                    review_status,
                }
            })
            .collect())
    }

    pub fn hydrate_from_db(&mut self, conn: &Connection) -> DbResult<()> {
        for summary in ProjectRepo::new(conn).list_summaries()? {
            self.register_project(&summary.id);
            let runtime = self.runtime_mut(&summary.id)?;
            runtime.reload_config(conn, &summary.id)?;
            runtime.apply_orchestrator_status(&summary.orchestrator_status);

            if Self::project_is_idle(conn, &summary.id)? {
                self.maybe_stop_runtime(conn, &summary.id)?;
                continue;
            }

            self.ensure_runtime_active(conn, &summary.id)?;
        }
        Ok(())
    }

    pub fn on_work_added(&mut self, conn: &Connection, project_id: &str) -> DbResult<()> {
        self.ensure_runtime_active(conn, project_id)?;
        self.fill_dispatch_slots(conn, project_id)
    }

    pub fn on_task_column_changed(&mut self, conn: &Connection, task: &Task) -> DbResult<()> {
        let project_id = task.project_id.clone();
        let now_iso = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
        let project = ProjectRepo::new(conn)
            .get(&project_id)?
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?;

        reconcile_running_attempts(
            self.adapter.as_ref(),
            &RunAttemptRepo::new(conn),
            &TaskRepo::new(conn),
            &AgentSessionRepo::new(conn),
            &RetryQueueRepo::new(conn),
            &self.pause_gates,
            &project,
            Some(task.id.as_str()),
            &now_iso,
            &self.emitter(),
        )?;

        if task.board_column == BoardColumnId::Done {
            let _ = self.workspaces.remove_workspace(&project_id, &task.id);
        }

        if task.board_column == BoardColumnId::Backlog {
            self.ensure_runtime_active(conn, &project_id)?;
            self.fill_dispatch_slots(conn, &project_id)?;
        }

        self.maybe_stop_runtime(conn, &project_id)
    }

    pub fn project_is_idle(conn: &Connection, project_id: &str) -> DbResult<bool> {
        if Self::project_has_backlog_tasks(conn, project_id)? {
            return Ok(false);
        }
        if !RunAttemptRepo::new(conn)
            .list_running(project_id)?
            .is_empty()
        {
            return Ok(false);
        }
        if !RetryQueueRepo::new(conn)
            .list_for_project(project_id)?
            .is_empty()
        {
            return Ok(false);
        }
        Ok(true)
    }

    pub fn ensure_runtime_active(&mut self, conn: &Connection, project_id: &str) -> DbResult<()> {
        if Self::project_is_idle(conn, project_id)? {
            return Ok(());
        }

        self.register_project(project_id);
        if self.runtime(project_id)?.status != RuntimeStatus::Running {
            self.start_runtime(conn, project_id)?;
        } else if !self.runtime(project_id)?.has_watchdog() {
            self.spawn_watchdog(project_id)?;
            self.fill_dispatch_slots(conn, project_id)?;
        }
        Ok(())
    }

    pub fn maybe_stop_runtime(&mut self, conn: &Connection, project_id: &str) -> DbResult<()> {
        if !Self::project_is_idle(conn, project_id)? {
            return Ok(());
        }

        self.register_project(project_id);
        let runtime = self.runtime_mut(project_id)?;
        if runtime.status != RuntimeStatus::Running {
            return Ok(());
        }

        runtime.stop_timer();
        runtime.status = RuntimeStatus::Idle;
        ProjectRepo::new(conn).update(
            project_id,
            &ProjectPatch {
                orchestrator_status: Some("idle".into()),
                ..ProjectPatch::default()
            },
        )?;
        self.emitter().orchestrator_status(project_id, "idle");
        Ok(())
    }

    fn handle_orchestrator_event(
        &mut self,
        conn: &Connection,
        event: OrchestratorEvent,
    ) -> DbResult<()> {
        let OrchestratorEvent::SessionTerminal { project_id, record } = event;
        self.on_session_terminal(conn, &project_id, record)
    }

    fn on_session_terminal(
        &mut self,
        conn: &Connection,
        project_id: &str,
        record: crate::acp::types::RuntimeSessionRecord,
    ) -> DbResult<()> {
        self.register_project(project_id);
        let project = ProjectRepo::new(conn)
            .get(project_id)?
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?;
        let now_iso = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
        let emitter = self.emitter();

        sync_session_outcome(
            conn,
            self.adapter.as_ref(),
            &record,
            &RunAttemptRepo::new(conn),
            &TaskRepo::new(conn),
            &AgentSessionRepo::new(conn),
            &RetryQueueRepo::new(conn),
            &self.pause_gates,
            &project,
            &now_iso,
            &emitter,
        )?;

        self.fill_dispatch_slots(conn, project_id)?;
        self.maybe_stop_runtime(conn, project_id)
    }

    pub fn try_dispatch_project(&mut self, conn: &Connection, project_id: &str) -> DbResult<()> {
        self.fill_dispatch_slots(conn, project_id)
    }

    fn fill_dispatch_slots(&mut self, conn: &Connection, project_id: &str) -> DbResult<()> {
        self.register_project(project_id);
        if self.runtime(project_id)?.status != RuntimeStatus::Running {
            return Ok(());
        }

        let project = ProjectRepo::new(conn)
            .get(project_id)?
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?;

        try_dispatch(
            conn,
            self.adapter.as_ref(),
            &RunAttemptRepo::new(conn),
            &TaskRepo::new(conn),
            &AgentSessionRepo::new(conn),
            &self.workspaces,
            &project,
            &self.pause_gates,
            &self.emitter(),
        )
    }

    fn project_has_backlog_tasks(conn: &Connection, project_id: &str) -> DbResult<bool> {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tasks WHERE project_id = ?1 AND board_column = ?2",
            rusqlite::params![project_id, BoardColumnId::Backlog.as_str()],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn start_runtime(&mut self, conn: &Connection, project_id: &str) -> DbResult<()> {
        self.register_project(project_id);
        if self.runtime(project_id)?.status == RuntimeStatus::Running
            && self.runtime(project_id)?.has_watchdog()
        {
            return self.fill_dispatch_slots(conn, project_id);
        }

        ProjectRepo::new(conn).update(
            project_id,
            &ProjectPatch {
                orchestrator_status: Some("running".into()),
                ..ProjectPatch::default()
            },
        )?;
        self.emitter().orchestrator_status(project_id, "running");

        let runtime = self.runtime_mut(project_id)?;
        runtime.reload_config(conn, project_id)?;
        runtime.status = RuntimeStatus::Running;

        if let Some(project) = runtime.config.clone() {
            let _ = cleanup_done_workspaces(&TaskRepo::new(conn), &self.workspaces, &project)?;
        }

        self.spawn_watchdog(project_id)?;
        self.fill_dispatch_slots(conn, project_id)
    }

    pub fn run_watchdog_cycle(&mut self, project_id: &str, conn: &Connection) -> DbResult<()> {
        self.register_project(project_id);
        let runtime = self.runtime_mut(project_id)?;
        if runtime.status != RuntimeStatus::Running {
            return Ok(());
        }

        runtime.reload_config(conn, project_id)?;
        let project = runtime
            .config
            .clone()
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?;
        let now_iso = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
        let emitter = self.emitter();

        let attempts = RunAttemptRepo::new(conn);
        let tasks = TaskRepo::new(conn);
        let sessions = AgentSessionRepo::new(conn);
        let retries = RetryQueueRepo::new(conn);

        reconcile_running_attempts(
            self.adapter.as_ref(),
            &attempts,
            &tasks,
            &sessions,
            &retries,
            &self.pause_gates,
            &project,
            None,
            &now_iso,
            &emitter,
        )?;

        sweep_orphan_sessions(
            conn,
            self.adapter.as_ref(),
            &attempts,
            &tasks,
            &sessions,
            &retries,
            &self.pause_gates,
            &project,
            &now_iso,
            &emitter,
        )?;

        dispatch_due_retries(
            conn,
            self.adapter.as_ref(),
            &attempts,
            &tasks,
            &sessions,
            &retries,
            &self.workspaces,
            &project,
            &now_iso,
            &self.pause_gates,
            &emitter,
        )?;

        try_dispatch(
            conn,
            self.adapter.as_ref(),
            &attempts,
            &tasks,
            &sessions,
            &self.workspaces,
            &project,
            &self.pause_gates,
            &emitter,
        )?;

        let _ = cleanup_done_workspaces(&tasks, &self.workspaces, &project)?;
        self.maybe_stop_runtime(conn, project_id)
    }

    fn spawn_watchdog(&mut self, project_id: &str) -> DbResult<()> {
        let db = Arc::clone(&self.db);
        let async_runtime = self.async_runtime.clone();
        let manager = self
            .self_handle
            .get()
            .ok_or_else(|| DbError::Internal("manager handle not attached".into()))?
            .clone();
        let project_id = project_id.to_string();

        self.runtime_mut(&project_id)?.set_timer(spawn_watchdog(
            async_runtime,
            db,
            manager,
            project_id,
            WATCHDOG_INTERVAL_MS,
        ));
        Ok(())
    }
}

fn runtime_task_summary(task: Option<&Task>) -> (String, Option<String>, Option<String>) {
    match task {
        Some(task) => (
            task.title.clone(),
            task.description.clone(),
            task.executor.clone(),
        ),
        None => ("Unknown task".into(), None, None),
    }
}

fn resolve_review_status(
    run_status: &str,
    board_column: BoardColumnId,
) -> Option<ReviewStatus> {
    if run_status != "succeeded" {
        return None;
    }
    Some(if board_column == BoardColumnId::Done {
        ReviewStatus::Approved
    } else {
        ReviewStatus::PendingReview
    })
}

fn parse_run_attempt_status(value: &str) -> RunAttemptStatus {
    match value {
        "succeeded" => RunAttemptStatus::Succeeded,
        "cancelled" => RunAttemptStatus::Cancelled,
        _ => RunAttemptStatus::Failed,
    }
}

fn running_session_id(conn: &Connection, run_attempt_id: &str) -> DbResult<String> {
    AgentSessionRepo::new(conn)
        .list_by_run_attempt(run_attempt_id)?
        .into_iter()
        .find(|session| session.status == "running")
        .map(|session| session.id)
        .ok_or_else(|| {
            DbError::NotFound(format!("running session for run attempt {run_attempt_id}"))
        })
}

fn spawn_watchdog(
    async_runtime: RuntimeHandle,
    db: Arc<Db>,
    manager: Arc<Mutex<Manager>>,
    project_id: String,
    watchdog_interval_ms: u32,
) -> JoinHandle<()> {
    async_runtime.spawn(async move {
        let mut interval = time::interval(Duration::from_millis(watchdog_interval_ms as u64));
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

        loop {
            interval.tick().await;

            let Ok(conn) = db.conn() else {
                log::warn!("watchdog {project_id}: db connection failed");
                continue;
            };
            let Ok(mut guard) = manager.lock() else {
                log::warn!("watchdog {project_id}: orchestrator lock poisoned");
                break;
            };
            let Ok(runtime) = guard.runtime(&project_id) else {
                break;
            };
            if runtime.status != RuntimeStatus::Running {
                break;
            }

            if let Err(err) = guard.run_watchdog_cycle(&project_id, &conn) {
                log::warn!("watchdog {project_id}: cycle error: {err}");
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::fixtures::{open_test_db, seed_minimal_project};
    use crate::db::repos::task::TaskRepo;
    use crate::db::repos::retry_queue::RetryQueueRepo;
    use crate::db::repos::run_attempt::RunAttemptRepo;

    #[test]
    fn project_is_idle_when_no_work() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        assert!(Manager::project_is_idle(&conn, &fixtures.project_id).expect("idle check"));
    }

    #[test]
    fn project_is_not_idle_when_backlog_has_tasks() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");

        TaskRepo::new(&conn)
            .create(
                &fixtures.project_id,
                "Backlog task",
                None,
                Some("hermes"),
                None,
                &[],
            )
            .expect("create task");

        assert!(!Manager::project_is_idle(&conn, &fixtures.project_id).expect("idle check"));
    }

    #[test]
    fn project_is_not_idle_when_running_attempt_exists() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        let tasks = TaskRepo::new(&conn);
        let attempts = RunAttemptRepo::new(&conn);

        let task = tasks
            .create(
                &fixtures.project_id,
                "Running task",
                None,
                Some("hermes"),
                None,
                &[],
            )
            .expect("create task");
        attempts
            .create_with_attempt_number(&task.id, 1)
            .expect("create attempt");

        assert!(!Manager::project_is_idle(&conn, &fixtures.project_id).expect("idle check"));
    }

    #[test]
    fn project_is_not_idle_when_retry_queue_has_entries() {
        let conn = open_test_db().expect("open db");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        let tasks = TaskRepo::new(&conn);
        let retries = RetryQueueRepo::new(&conn);

        let task = tasks
            .create(
                &fixtures.project_id,
                "Retry task",
                None,
                Some("hermes"),
                None,
                &[],
            )
            .expect("create task");
        retries
            .upsert(&task.id, 2, "2099-01-01T00:00:00+00:00", Some("retry"))
            .expect("queue retry");

        assert!(!Manager::project_is_idle(&conn, &fixtures.project_id).expect("idle check"));
    }
}

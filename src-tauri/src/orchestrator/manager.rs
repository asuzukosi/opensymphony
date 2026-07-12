use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use chrono::Utc;
use rusqlite::Connection;
use tauri::async_runtime::{JoinHandle, RuntimeHandle};
use tokio::time::{self, MissedTickBehavior};

use crate::acp::types::AcpAdapter;
use crate::db::error::{DbError, DbResult};
use crate::db::Db;
use crate::db::repos::agent_session::AgentSessionRepo;
use crate::db::repos::audit::AuditRepo;
use crate::db::repos::issue::IssueRepo;
use crate::db::repos::project::ProjectRepo;
use crate::db::repos::retry_queue::RetryQueueRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::types::{
    BoardColumnId, ProjectPatch, RuntimeAuditEvent, RuntimeRecentFinishedEntry,
    RuntimeRetryEntry, RuntimeRunningEntry, RuntimeStatus, ReviewStatus, RunAttemptStatus,
};

use super::audit::{self, action};
use super::pause::PauseGateRegistry;
use super::recovery::recover_stale_runs;
use super::runtime::{CycleContext, Runtime};
use super::workspace::{cleanup_done_workspaces, WorkspaceManager};

pub struct Manager {
    db: Arc<Db>,
    async_runtime: RuntimeHandle,
    adapter: Arc<dyn AcpAdapter>,
    workspaces: WorkspaceManager,
    pause_gates: PauseGateRegistry,
    self_handle: OnceLock<Arc<Mutex<Manager>>>,
    runtimes: HashMap<String, Runtime>,
}

impl Manager {
    pub fn new(
        db: Arc<Db>,
        async_runtime: RuntimeHandle,
        adapter: Arc<dyn AcpAdapter>,
        workspaces: WorkspaceManager,
    ) -> Self {
        Self {
            db,
            async_runtime,
            adapter,
            workspaces,
            pause_gates: PauseGateRegistry::default(),
            self_handle: OnceLock::new(),
            runtimes: HashMap::new(),
        }
    }

    pub fn pause_run(&self, conn: &Connection, run_attempt_id: &str) -> DbResult<()> {
        let session_id = running_session_id(conn, run_attempt_id)?;
        self.pause_gates.pause(&session_id)
    }

    pub fn resume_run(&self, conn: &Connection, run_attempt_id: &str) -> DbResult<()> {
        let session_id = running_session_id(conn, run_attempt_id)?;
        self.pause_gates.resume(&session_id)
    }

    pub fn cancel_run(
        &mut self,
        conn: &Connection,
        project_id: &str,
        run_attempt_id: &str,
    ) -> DbResult<()> {
        self.register_project(project_id);
        let project = ProjectRepo::new(conn)
            .get(project_id)?
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?;
        let now_iso = Utc::now().to_rfc3339();

        let Manager {
            adapter,
            pause_gates,
            ..
        } = self;

        super::poll::cancel_run_attempt(
            conn,
            adapter.as_ref(),
            &RunAttemptRepo::new(conn),
            &AgentSessionRepo::new(conn),
            &RetryQueueRepo::new(conn),
            pause_gates,
            &project,
            run_attempt_id,
            &now_iso,
        )
    }

    pub fn attach_handle(handle: &Arc<Mutex<Manager>>) {
        let Ok(guard) = handle.lock() else {
            return;
        };
        let _ = guard.self_handle.set(Arc::clone(handle));
    }

    pub fn register_project(&mut self, project_id: impl Into<String>) -> &Runtime {
        let project_id = project_id.into();
        self.runtimes
            .entry(project_id.clone())
            .or_insert_with(|| Runtime::new(project_id))
    }

    pub fn get(&self, project_id: &str) -> DbResult<&Runtime> {
        self.runtimes
            .get(project_id)
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))
    }

    pub fn runtime_running(
        &self,
        conn: &Connection,
        project_id: &str,
    ) -> DbResult<Vec<RuntimeRunningEntry>> {
        let issue_repo = IssueRepo::new(conn);
        let session_repo = AgentSessionRepo::new(conn);
        let attempts = RunAttemptRepo::new(conn).list_running(project_id)?;

        let mut entries = Vec::with_capacity(attempts.len());
        for attempt in attempts {
            let identifier = issue_repo
                .get(&attempt.issue_id)?
                .map(|issue| issue.identifier)
                .unwrap_or_default();

            let running_session = session_repo
                .list_by_run_attempt(&attempt.id)?
                .into_iter()
                .find(|session| session.status == "running");

            let (session_id, session_status, phase, current_activity, paused) =
                match running_session {
                    Some(session) => {
                        let sid = session.id;
                        (
                            Some(sid.clone()),
                            Some(session.status),
                            self.adapter.get_session_phase(&sid),
                            self.adapter.get_current_activity(&sid),
                            self.adapter.is_session_paused(&sid),
                        )
                    }
                    None => (None, None, None, None, false),
                };

            entries.push(RuntimeRunningEntry {
                run_attempt_id: attempt.id,
                issue_id: attempt.issue_id,
                identifier,
                attempt_number: attempt.attempt_number as u32,
                started_at: attempt.started_at,
                session_id,
                session_status,
                phase,
                current_activity,
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
        let issue_repo = IssueRepo::new(conn);
        let retries = RetryQueueRepo::new(conn).list_for_project(project_id)?;

        let mut entries = Vec::with_capacity(retries.len());
        for entry in retries {
            let identifier = issue_repo
                .get(&entry.issue_id)?
                .map(|issue| issue.identifier)
                .unwrap_or_default();

            entries.push(RuntimeRetryEntry {
                issue_id: entry.issue_id,
                identifier,
                attempt_number: entry.attempt_number as u32,
                due_at: entry.due_at,
                error_message: entry.error_message,
            });
        }
        Ok(entries)
    }

    pub fn runtime_recent_finished(
        &self,
        conn: &Connection,
        project_id: &str,
        limit: i32,
    ) -> DbResult<Vec<RuntimeRecentFinishedEntry>> {
        let issue_repo = IssueRepo::new(conn);
        let attempts = RunAttemptRepo::new(conn).list_recent_finished(project_id, limit)?;

        let mut entries = Vec::with_capacity(attempts.len());
        for attempt in attempts {
            let issue = issue_repo.get(&attempt.issue_id)?;
            let identifier = issue
                .as_ref()
                .map(|row| row.identifier.clone())
                .unwrap_or_default();
            let review_status = issue
                .as_ref()
                .and_then(|row| resolve_review_status(&attempt.status, row.board_column));

            entries.push(RuntimeRecentFinishedEntry {
                run_attempt_id: attempt.id,
                issue_id: attempt.issue_id,
                identifier,
                attempt_number: attempt.attempt_number as u32,
                status: parse_run_attempt_status(&attempt.status),
                finished_at: attempt.finished_at.unwrap_or_default(),
                error_message: attempt.error_message,
                review_status,
            });
        }
        Ok(entries)
    }

    pub fn runtime_recent_events(
        &self,
        conn: &Connection,
        project_id: &str,
        limit: i32,
    ) -> DbResult<Vec<RuntimeAuditEvent>> {
        let events = AuditRepo::new(conn).list_recent(project_id, limit)?;
        Ok(events
            .into_iter()
            .map(|event| RuntimeAuditEvent {
                action: event.action,
                issue_id: event.issue_id,
                created_at: event.created_at,
            })
            .collect())
    }

    pub fn hydrate_from_db(&mut self, conn: &Connection) -> DbResult<()> {
        for summary in ProjectRepo::new(conn).list_summaries()? {
            self.register_project(&summary.id);
            let runtime = self.get_mut(&summary.id)?;
            runtime.reload_config(conn)?;
            runtime.apply_orchestrator_status(&summary.orchestrator_status);
            self.ensure_runtime_for_backlog(conn, &summary.id)?;
        }
        Ok(())
    }

    pub fn ensure_runtime_for_backlog(
        &mut self,
        conn: &Connection,
        project_id: &str,
    ) -> DbResult<()> {
        if !Self::project_has_backlog_issues(conn, project_id)? {
            return Ok(());
        }

        self.register_project(project_id);
        if self.get(project_id)?.status != RuntimeStatus::Running {
            self.start_runtime(conn, project_id)?;
        }
        Ok(())
    }

    fn project_has_backlog_issues(conn: &Connection, project_id: &str) -> DbResult<bool> {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM issues WHERE project_id = ?1 AND board_column = ?2",
            rusqlite::params![project_id, BoardColumnId::Backlog.as_str()],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn start(&mut self, project_id: &str, conn: &Connection) -> DbResult<()> {
        let project = ProjectRepo::new(conn)
            .get(project_id)?
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?;

        let recovered = recover_stale_runs(
            &RunAttemptRepo::new(conn),
            &AgentSessionRepo::new(conn),
            &RetryQueueRepo::new(conn),
            &project,
        )?;
        let cleaned =
            cleanup_done_workspaces(&IssueRepo::new(conn), &self.workspaces, &project)?;

        self.get_mut(project_id)?.start(conn)?;
        if recovered > 0 {
            audit::log(conn, project_id, action::RESTART_RECOVERY_APPLIED, None)?;
        }
        if cleaned > 0 {
            audit::log(conn, project_id, action::WORKSPACE_CLEANUP_STARTUP, None)?;
        }
        audit::log(conn, project_id, action::RUNTIME_STARTED, None)?;
        let poll_ms = self.get(project_id)?.poll_interval_ms();
        self.spawn_poll_timer(project_id, poll_ms)
    }

    pub fn start_runtime(&mut self, conn: &Connection, project_id: &str) -> DbResult<()> {
        self.register_project(project_id);
        ProjectRepo::new(conn).update(
            project_id,
            &ProjectPatch {
                orchestrator_status: Some("running".into()),
                ..ProjectPatch::default()
            },
        )?;
        self.start(project_id, conn)?;
        self.run_project_cycle(project_id, conn)
    }

    pub(crate) fn run_project_cycle(&mut self, project_id: &str, conn: &Connection) -> DbResult<()> {
        let Manager {
            runtimes,
            adapter,
            workspaces,
            pause_gates,
            ..
        } = self;
        let runtime = runtimes
            .get_mut(project_id)
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?;
        let cycle_ctx = CycleContext {
            adapter: adapter.as_ref(),
            workspaces,
            pause_gates,
        };
        runtime.run_cycle(conn, &cycle_ctx)
    }

    pub(crate) fn get_mut(&mut self, project_id: &str) -> DbResult<&mut Runtime> {
        self.runtimes
            .get_mut(project_id)
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))
    }

    fn spawn_poll_timer(&mut self, project_id: &str, poll_ms: u32) -> DbResult<()> {
        let db = Arc::clone(&self.db);
        let async_runtime = self.async_runtime.clone();
        let manager = self.self_handle.get().map(Arc::clone);
        let project_id = project_id.to_string();

        let runtime = self.get_mut(&project_id)?;
        if let Some(manager) = manager {
            runtime.set_timer(spawn_poll_timer(
                async_runtime,
                db,
                manager,
                project_id,
                poll_ms,
            ));
        }
        Ok(())
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

fn spawn_poll_timer(
    async_runtime: RuntimeHandle,
    db: Arc<Db>,
    manager: Arc<Mutex<Manager>>,
    project_id: String,
    poll_interval_ms: u32,
) -> JoinHandle<()> {
    async_runtime.spawn(async move {
        let mut interval = time::interval(Duration::from_millis(poll_interval_ms as u64));
        interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

        loop {
            interval.tick().await;

            let Ok(conn) = db.conn() else {
                continue;
            };
            let Ok(mut guard) = manager.lock() else {
                break;
            };
            let Ok(project_runtime) = guard.get_mut(&project_id) else {
                break;
            };
            if project_runtime.status != RuntimeStatus::Running {
                break;
            }

            if guard.run_project_cycle(&project_id, &conn).is_err() {
                break;
            }
        }
    })
}

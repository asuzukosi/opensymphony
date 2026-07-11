use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use chrono::{Duration as ChronoDuration, Utc};
use rusqlite::Connection;
use tauri::async_runtime::{JoinHandle, RuntimeHandle};
use tokio::time::{self, MissedTickBehavior};

use crate::acp::permissions::PermissionGate;
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
    BoardColumnId, ProjectPatch, RuntimeAuditEvent, RuntimeCandidateEntry,
    RuntimeRecentFinishedEntry, RuntimeRetryEntry, RuntimeRunningEntry, RuntimeStatus,
    RuntimeSummary, ReviewStatus, RunAttemptStatus,
};

use super::audit::{self, action};
use super::pause::PauseGateRegistry;
use super::recovery::recover_stale_runs;
use super::runtime::{Runtime, TickContext};
use super::workspace::{cleanup_done_workspaces, WorkspaceManager};
use super::DEFAULT_POLL_INTERVAL_MS;

pub struct Manager {
    db: Arc<Db>,
    async_runtime: RuntimeHandle,
    adapter: Arc<dyn AcpAdapter>,
    permission_gate: Arc<PermissionGate>,
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
        permission_gate: Arc<PermissionGate>,
        workspaces: WorkspaceManager,
    ) -> Self {
        Self {
            db,
            async_runtime,
            adapter,
            permission_gate,
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
            workspaces,
            pause_gates,
            runtimes,
            ..
        } = self;
        let runtime = runtimes
            .get_mut(project_id)
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?;

        super::poll::cancel_run_attempt(
            conn,
            adapter.as_ref(),
            &RunAttemptRepo::new(conn),
            &AgentSessionRepo::new(conn),
            &RetryQueueRepo::new(conn),
            workspaces,
            runtime,
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

    pub fn runtime_summary(&self, project_id: &str) -> DbResult<RuntimeSummary> {
        self.get(project_id).map(Runtime::summary)
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

    pub fn runtime_candidates(
        &self,
        conn: &Connection,
        project_id: &str,
    ) -> DbResult<Vec<RuntimeCandidateEntry>> {
        let cards = IssueRepo::new(conn).list_candidates(project_id)?;
        Ok(cards
            .into_iter()
            .map(|card| RuntimeCandidateEntry {
                issue_id: card.issue_id,
                identifier: card.identifier,
                title: card.title,
                priority: card.priority,
                state_category: BoardColumnId::Backlog.as_str().into(),
            })
            .collect())
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
        }
        Ok(())
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
            cleanup_done_workspaces(&IssueRepo::new(conn), &self.workspaces, project_id)?;

        self.get_mut(project_id)?.start(conn)?;
        self.permission_gate
            .sync_project_mode(&project.id, project.permission_mode);
        if recovered > 0 {
            audit::log(conn, project_id, action::RESTART_RECOVERY_APPLIED, None)?;
        }
        if cleaned > 0 {
            audit::log(conn, project_id, action::WORKSPACE_CLEANUP_STARTUP, None)?;
        }
        audit::log(conn, project_id, action::RUNTIME_STARTED, None)?;
        let poll_ms = self
            .get(project_id)?
            .effective_poll_interval_ms()
            .unwrap_or(DEFAULT_POLL_INTERVAL_MS);
        self.spawn_poll_timer(project_id, poll_ms)
    }

    pub fn stop(&mut self, project_id: &str, conn: &Connection) -> DbResult<()> {
        self.get_mut(project_id)?.stop();
        audit::log(conn, project_id, action::RUNTIME_STOPPED, None)?;
        Ok(())
    }

    pub fn tick_now(&mut self, project_id: &str, conn: &Connection) -> DbResult<()> {
        self.tick_project(project_id, conn)
    }

    pub fn start_runtime(&mut self, conn: &Connection, project_id: &str) -> DbResult<RuntimeSummary> {
        self.register_project(project_id);
        ProjectRepo::new(conn).update(
            project_id,
            &ProjectPatch {
                orchestrator_status: Some("running".into()),
                ..ProjectPatch::default()
            },
        )?;
        self.start(project_id, conn)?;
        self.runtime_summary(project_id)
    }

    pub fn stop_runtime(&mut self, conn: &Connection, project_id: &str) -> DbResult<RuntimeSummary> {
        self.register_project(project_id);
        ProjectRepo::new(conn).update(
            project_id,
            &ProjectPatch {
                orchestrator_status: Some("stopped".into()),
                ..ProjectPatch::default()
            },
        )?;
        self.stop(project_id, conn)?;
        self.runtime_summary(project_id)
    }

    pub fn tick_runtime(&mut self, conn: &Connection, project_id: &str) -> DbResult<RuntimeSummary> {
        self.register_project(project_id);
        self.tick_now(project_id, conn)?;
        self.runtime_summary(project_id)
    }

    pub fn set_runtime_poll_interval(
        &mut self,
        conn: &Connection,
        project_id: &str,
        poll_interval_ms: i32,
    ) -> DbResult<u32> {
        let project = ProjectRepo::new(conn).update(
            project_id,
            &ProjectPatch {
                poll_interval_ms: Some(poll_interval_ms),
                ..ProjectPatch::default()
            },
        )?;
        let poll_ms = project.poll_interval_ms as u32;
        self.set_poll_interval_override(project_id, poll_ms)?;
        Ok(poll_ms)
    }

    pub fn clear_runtime_poll_interval_override(
        &mut self,
        conn: &Connection,
        project_id: &str,
    ) -> DbResult<u32> {
        let project = ProjectRepo::new(conn)
            .get(project_id)?
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?;
        let poll_interval_ms = workflow_default_poll_interval(&project);
        let updated = ProjectRepo::new(conn).update(
            project_id,
            &ProjectPatch {
                poll_interval_ms: Some(poll_interval_ms),
                ..ProjectPatch::default()
            },
        )?;
        let poll_ms = updated.poll_interval_ms as u32;
        self.clear_poll_interval_override(project_id, poll_ms)?;
        Ok(poll_ms)
    }

    pub fn set_poll_interval_override(&mut self, project_id: &str, poll_ms: u32) -> DbResult<()> {
        let status = self.get(project_id)?.status;
        self.get_mut(project_id)?.poll_interval_override = Some(poll_ms);
        if status == RuntimeStatus::Running {
            self.spawn_poll_timer(project_id, poll_ms)?;
        }
        Ok(())
    }

    pub fn clear_poll_interval_override(&mut self, project_id: &str, poll_ms: u32) -> DbResult<()> {
        let status = self.get(project_id)?.status;
        self.get_mut(project_id)?.poll_interval_override = None;
        if status == RuntimeStatus::Running {
            self.spawn_poll_timer(project_id, poll_ms)?;
        }
        Ok(())
    }

    pub(crate) fn tick_project(&mut self, project_id: &str, conn: &Connection) -> DbResult<()> {
        let old_poll_ms = self.get(project_id)?.effective_poll_interval_ms();
        let status = self.get(project_id)?.status;
        let has_override = self.get(project_id)?.poll_interval_override.is_some();

        let Manager {
            runtimes,
            adapter,
            workspaces,
            pause_gates,
            permission_gate,
            ..
        } = self;
        let runtime = runtimes
            .get_mut(project_id)
            .ok_or_else(|| DbError::NotFound(format!("project {project_id}")))?;
        let tick_ctx = TickContext {
            adapter: adapter.as_ref(),
            workspaces,
            pause_gates,
            permission_gate,
        };
        runtime.tick(conn, &tick_ctx)?;

        if has_override || status != RuntimeStatus::Running {
            return Ok(());
        }

        let new_poll_ms = self
            .get(project_id)?
            .effective_poll_interval_ms()
            .unwrap_or(DEFAULT_POLL_INTERVAL_MS);
        if old_poll_ms == Some(new_poll_ms) {
            return Ok(());
        }

        self.spawn_poll_timer(project_id, new_poll_ms)
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
        runtime.next_tick_at = Some(Utc::now() + ChronoDuration::milliseconds(poll_ms as i64));

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

fn workflow_default_poll_interval(project: &crate::types::Project) -> i32 {
    project.poll_interval_ms
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

            if let Some(poll_ms) = project_runtime.effective_poll_interval_ms() {
                project_runtime.next_tick_at =
                    Some(Utc::now() + ChronoDuration::milliseconds(poll_ms as i64));
            }

            if guard.tick_project(&project_id, &conn).is_err() {
                break;
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use uuid::Uuid;

    use super::*;
    use crate::acp::noop_adapter::NoopAcpAdapter;
    use crate::acp::types::AcpAdapter;
    use crate::acp::permissions::PermissionGate;
    use crate::db::repos::audit::AuditRepo;
    use crate::db::repos::comment::CommentRepo;
    use crate::db::repos::issue::IssueRepo;
    use crate::db::repos::project::ProjectRepo;
    use crate::db::repos::run_attempt::RunAttemptRepo;
    use crate::db::fixtures::seed_minimal_project;
    use crate::orchestrator::audit::action;
    use crate::types::{BoardColumnId, RuntimeStatus};

    fn temp_db_path() -> PathBuf {
        std::env::temp_dir().join(format!("orch-manager-test-{}.sqlite", Uuid::new_v4()))
    }

    fn test_permission_gate(db: &Arc<Db>) -> Arc<PermissionGate> {
        Arc::new(PermissionGate::new(Arc::clone(db)))
    }

    #[test]
    #[ignore = "dispatch still uses agent registry until V4"]
    fn runtime_tick_dispatches_then_polls_issue_to_review() {
        let path = temp_db_path();
        let db = Arc::new(Db::open(&path).expect("open test db"));
        let conn = db.conn().expect("lock connection");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        let adapter: Arc<dyn AcpAdapter> = Arc::new(NoopAcpAdapter::new());
        let workspaces = WorkspaceManager::new(
            std::env::temp_dir().join(format!("orch-tick-ws-{}", Uuid::new_v4())),
        );
        let mut manager = Manager::new(
            Arc::clone(&db),
            tauri::async_runtime::handle(),
            adapter,
            test_permission_gate(&db),
            workspaces,
        );

        manager.register_project(&fixtures.project_id);
        manager.start(&fixtures.project_id, &conn).expect("start");
        manager
            .tick_now(&fixtures.project_id, &conn)
            .expect("dispatch tick");
        manager
            .tick_now(&fixtures.project_id, &conn)
            .expect("poll tick");

        let running = RunAttemptRepo::new(&conn)
            .list_running(&fixtures.project_id)
            .expect("running");
        assert!(running.is_empty());

        let issue = IssueRepo::new(&conn)
            .get(&fixtures.backlog_issue_id)
            .expect("get issue")
            .expect("issue");
        assert_eq!(issue.board_column, BoardColumnId::Review);

        let comments = CommentRepo::new(&conn)
            .list_by_issue(&fixtures.backlog_issue_id)
            .expect("list comments");
        assert_eq!(comments.len(), 1);
        assert_eq!(comments[0].author_id.as_deref(), Some("Test Agent"));

        let recent = AuditRepo::new(&conn)
            .list_recent(&fixtures.project_id, 10)
            .expect("audit tail");
        let actions: Vec<_> = recent.iter().map(|event| event.action.as_str()).collect();
        assert!(actions.contains(&action::ATTEMPT_DISPATCHED));
        assert!(actions.contains(&action::ATTEMPT_SUCCEEDED));

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn stop_runtime_syncs_db_and_stops_timer() {
        let path = temp_db_path();
        let db = Arc::new(Db::open(&path).expect("open test db"));
        let conn = db.conn().expect("lock connection");
        let fixtures = seed_minimal_project(&conn).expect("seed");
        let mut manager = Manager::new(
            Arc::clone(&db),
            tauri::async_runtime::handle(),
            Arc::new(NoopAcpAdapter::new()),
            test_permission_gate(&db),
            WorkspaceManager::new(
                std::env::temp_dir().join(format!("orch-stop-ipc-ws-{}", Uuid::new_v4())),
            ),
        );

        manager
            .start_runtime(&conn, &fixtures.project_id)
            .expect("start runtime");
        let summary = manager
            .stop_runtime(&conn, &fixtures.project_id)
            .expect("stop runtime");
        assert_eq!(summary.status, RuntimeStatus::Stopped);
        assert!(summary.next_tick_at.is_none());

        let project = ProjectRepo::new(&conn)
            .get(&fixtures.project_id)
            .expect("get project")
            .expect("project");
        assert_eq!(project.orchestrator_status, "stopped");

        let _ = std::fs::remove_file(path);
    }
}

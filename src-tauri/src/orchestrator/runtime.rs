use chrono::{DateTime, Utc};
use rusqlite::Connection;
use tauri::async_runtime::JoinHandle;

use crate::db::error::{DbError, DbResult};
use crate::db::repos::agent_session::AgentSessionRepo;
use crate::db::repos::issue::IssueRepo;
use crate::db::repos::project::ProjectRepo;
use crate::db::repos::retry_queue::RetryQueueRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::types::{Project, RuntimeStatus};
use crate::acp::types::AcpAdapter;

use super::pause::PauseGateRegistry;
use super::poll::{poll_running_sessions, reconcile_running_attempts, run_poll_cycle};
use super::workspace::{cleanup_done_workspaces, WorkspaceManager};

pub(crate) struct CycleContext<'a> {
    pub adapter: &'a dyn AcpAdapter,
    pub workspaces: &'a WorkspaceManager,
    pub pause_gates: &'a PauseGateRegistry,
}

pub struct Runtime {
    pub(crate) project_id: String,
    pub(crate) config: Option<Project>,
    pub(crate) status: RuntimeStatus,
    pub(crate) started_at: Option<DateTime<Utc>>,
    pub(crate) last_error: Option<String>,
    timer: Option<JoinHandle<()>>,
}

impl Runtime {
    pub fn new(project_id: String) -> Self {
        Self {
            project_id,
            config: None,
            status: RuntimeStatus::Idle,
            started_at: None,
            last_error: None,
            timer: None,
        }
    }

    pub fn apply_orchestrator_status(&mut self, value: &str) {
        self.status = match value {
            "running" => RuntimeStatus::Running,
            "stopped" => RuntimeStatus::Stopped,
            _ => RuntimeStatus::Idle,
        };
    }

    pub fn poll_interval_ms(&self) -> u32 {
        self.config
            .as_ref()
            .map(|project| project.poll_interval_ms as u32)
            .unwrap_or(super::DEFAULT_POLL_INTERVAL_MS)
    }

    pub fn reload_config(&mut self, conn: &Connection) -> DbResult<()> {
        self.config = Some(
            ProjectRepo::new(conn)
                .get(&self.project_id)?
                .ok_or_else(|| DbError::NotFound(format!("project {}", self.project_id)))?,
        );
        Ok(())
    }

    pub fn start(&mut self, conn: &Connection) -> DbResult<()> {
        self.reload_config(conn)?;
        self.started_at.get_or_insert_with(Utc::now);
        self.status = RuntimeStatus::Running;
        self.last_error = None;
        Ok(())
    }

    pub fn run_cycle(&mut self, conn: &Connection, ctx: &CycleContext<'_>) -> DbResult<()> {
        self.reload_config(conn)?;

        if self.status != RuntimeStatus::Running {
            return Ok(());
        }

        let project = self
            .config
            .as_ref()
            .ok_or_else(|| DbError::NotFound(format!("project {}", self.project_id)))?
            .clone();
        let project_id = self.project_id.clone();
        let now_iso = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);

        let attempts = RunAttemptRepo::new(conn);
        let issues = IssueRepo::new(conn);
        let sessions = AgentSessionRepo::new(conn);
        let retries = RetryQueueRepo::new(conn);

        reconcile_running_attempts(&attempts, &issues, &retries, &project_id)?;

        let _ = poll_running_sessions(
            conn,
            ctx.adapter,
            &attempts,
            &issues,
            &sessions,
            &retries,
            ctx.pause_gates,
            &project,
            &now_iso,
        )?;

        let _ = run_poll_cycle(
            conn,
            ctx.adapter,
            &attempts,
            &issues,
            &sessions,
            &retries,
            ctx.workspaces,
            &project,
            &now_iso,
            ctx.pause_gates,
        )?;

        let _ = cleanup_done_workspaces(&issues, ctx.workspaces, &project)?;
        self.last_error = None;
        Ok(())
    }

    pub(crate) fn set_timer(&mut self, handle: JoinHandle<()>) {
        self.abort_timer();
        self.timer = Some(handle);
    }

    fn abort_timer(&mut self) {
        if let Some(handle) = self.timer.take() {
            handle.abort();
        }
    }
}

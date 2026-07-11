use chrono::{DateTime, Utc};
use rusqlite::Connection;
use std::collections::HashMap;
use tauri::async_runtime::JoinHandle;

use crate::db::error::{DbError, DbResult};
use crate::db::repos::agent_session::AgentSessionRepo;
use crate::db::repos::issue::IssueRepo;
use crate::db::repos::project::ProjectRepo;
use crate::db::repos::retry_queue::RetryQueueRepo;
use crate::db::repos::run_attempt::RunAttemptRepo;
use crate::types::{Project, RuntimeStatus, RuntimeSummary};
use crate::utils::iso_timestamp;

use super::audit::{self, action};
use super::pause::PauseGateRegistry;
use super::poll::{poll_running_sessions, reconcile_running_attempts, run_poll_cycle};
use super::workspace::WorkspaceManager;
use super::DEFAULT_POLL_INTERVAL_MS;
use crate::acp::permissions::PermissionGate;
use crate::acp::types::AcpAdapter;

pub(crate) struct TickContext<'a> {
    pub adapter: &'a dyn AcpAdapter,
    pub workspaces: &'a WorkspaceManager,
    pub pause_gates: &'a PauseGateRegistry,
    pub permission_gate: &'a PermissionGate,
}

pub struct Runtime {
    pub(crate) project_id: String,
    pub(crate) config: Option<Project>,
    pub(crate) status: RuntimeStatus,
    pub(crate) started_at: Option<DateTime<Utc>>,
    pub(crate) poll_interval_override: Option<u32>,
    pub(crate) next_tick_at: Option<DateTime<Utc>>,
    pub(crate) tick_count: u32,
    pub(crate) last_tick_at: Option<DateTime<Utc>>,
    pub(crate) last_dispatched_count: u32,
    pub(crate) last_action: Option<String>,
    pub(crate) last_error: Option<String>,
    workspaces: HashMap<String, String>,
    timer: Option<JoinHandle<()>>,
}

impl Runtime {
    pub fn new(project_id: String) -> Self {
        Self {
            project_id,
            config: None,
            status: RuntimeStatus::Idle,
            started_at: None,
            poll_interval_override: None,
            next_tick_at: None,
            tick_count: 0,
            last_tick_at: None,
            last_dispatched_count: 0,
            last_action: None,
            last_error: None,
            workspaces: HashMap::new(),
            timer: None,
        }
    }

    pub(crate) fn track_workspace(
        &mut self,
        run_attempt_id: impl Into<String>,
        issue_id: impl Into<String>,
    ) {
        self.workspaces
            .insert(run_attempt_id.into(), issue_id.into());
    }

    pub(crate) fn release_workspace(
        &mut self,
        run_attempt_id: &str,
        workspaces: &WorkspaceManager,
    ) -> DbResult<()> {
        let Some(issue_id) = self.workspaces.remove(run_attempt_id) else {
            return Ok(());
        };
        workspaces.remove_workspace(&self.project_id, &issue_id)
    }

    pub fn apply_orchestrator_status(&mut self, value: &str) {
        self.status = match value {
            "running" => RuntimeStatus::Running,
            "stopped" => RuntimeStatus::Stopped,
            _ => RuntimeStatus::Idle,
        };
    }

    pub fn effective_poll_interval_ms(&self) -> Option<u32> {
        self.poll_interval_override
            .or_else(|| self.config.as_ref().map(|project| project.poll_interval_ms as u32))
    }

    pub fn summary(&self) -> RuntimeSummary {
        RuntimeSummary {
            status: self.status,
            poll_interval_ms: self
                .effective_poll_interval_ms()
                .unwrap_or(DEFAULT_POLL_INTERVAL_MS),
            started_at: iso_timestamp(self.started_at),
            next_tick_at: iso_timestamp(self.next_tick_at),
            tick_count: self.tick_count,
            last_tick_at: iso_timestamp(self.last_tick_at),
            last_dispatched_count: self.last_dispatched_count,
            last_action: self.last_action.clone(),
            last_error: self.last_error.clone(),
            validation_error: None,
        }
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

    pub fn stop(&mut self) {
        self.abort_timer();
        self.status = RuntimeStatus::Stopped;
        self.next_tick_at = None;
    }

    pub fn tick(&mut self, conn: &Connection, ctx: &TickContext<'_>) -> DbResult<()> {
        self.reload_config(conn)?;
        let workflow_reloaded = self.reload_workflow_if_changed(conn)?;
        if let Some(project) = self.config.as_ref() {
            ctx.permission_gate
                .sync_project_mode(&self.project_id, project.permission_mode);
        }
        if workflow_reloaded {
            audit::log(conn, &self.project_id, action::WORKFLOW_RELOADED, None)?;
        }

        let mut last_action = if workflow_reloaded {
            "workflow_reloaded".to_string()
        } else {
            "tick_completed".to_string()
        };

        if self.status == RuntimeStatus::Running {
            let project = self
                .config
                .as_ref()
                .ok_or_else(|| DbError::NotFound(format!("project {}", self.project_id)))?
                .clone();
            let project_id = self.project_id.clone();
            let now_iso = Utc::now()
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);

            let attempts = RunAttemptRepo::new(conn);
            let issues = IssueRepo::new(conn);
            let sessions = AgentSessionRepo::new(conn);
            let retries = RetryQueueRepo::new(conn);

            reconcile_running_attempts(
                &attempts,
                &issues,
                &retries,
                self,
                ctx.workspaces,
                &project_id,
            )?;

            let finished = poll_running_sessions(
                conn,
                ctx.adapter,
                &attempts,
                &issues,
                &sessions,
                &retries,
                ctx.workspaces,
                self,
                ctx.pause_gates,
                &project,
                &now_iso,
            )?;
            if finished > 0 {
                last_action = format!("polled_{finished}_sessions");
            }

            let dispatched = run_poll_cycle(
                conn,
                ctx.adapter,
                &attempts,
                &issues,
                &sessions,
                &retries,
                ctx.workspaces,
                self,
                &project,
                &now_iso,
                ctx.pause_gates,
            )?;
            self.last_dispatched_count = dispatched.len() as u32;
            if !dispatched.is_empty() {
                last_action = format!("dispatched_{}", dispatched.len());
            }
        } else {
            self.last_dispatched_count = 0;
        }

        self.tick_count = self.tick_count.saturating_add(1);
        self.last_tick_at = Some(Utc::now());
        self.last_action = Some(last_action);
        self.last_error = None;
        audit::log(conn, &self.project_id, action::TICK_COMPLETED, None)?;
        Ok(())
    }

    fn reload_workflow_if_changed(&mut self, _conn: &Connection) -> DbResult<bool> {
        Ok(false)
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


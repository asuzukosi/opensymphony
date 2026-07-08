//! acp client adapter: spawn agents, track sessions, launch background run loop.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use agent_client_protocol::schema::{
    CancelNotification, ContentBlock, NewSessionRequest, PromptRequest, SessionId,
    SessionNotification, TextContent,
};
use agent_client_protocol::{Agent, ByteStreams, ConnectionTo, Error};
use agent_client_protocol_tokio::AcpAgent;
use serde_json::json;
use tokio::process::{Child, Command};
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};
use tauri::async_runtime::RuntimeHandle;

use crate::db::repos::agent_session::AgentSessionRepo;
use crate::db::Db;
use crate::types::{RuntimeSessionPhase, SessionEventKind};

use super::client::connect;
use super::context::{SessionCtx, StoredSession};
use super::permissions::{permission_handler, PermissionGate};
use super::protocol::default_initialize_request;
use super::recorder::Recorder;
use super::renderers::render_task_prompt;
use super::types::{
    AcpAdapter, RuntimeSessionRecord, RuntimeSessionStatus, StartRuntimeSessionInput,
};

const CANCEL_SIGTERM_FALLBACK_MS: u64 = 1500;

pub struct AcpClientConfig {
    command: PathBuf,
    args: Vec<String>,
}

impl AcpClientConfig {
    pub fn from_acp_command(command: &str) -> Result<Self, String> {
        let trimmed = command.trim();
        if trimmed.is_empty() {
            return Err("acp command is empty".into());
        }
        if std::path::Path::new(trimmed).is_file() {
            return Ok(Self {
                command: PathBuf::from(trimmed),
                args: Vec::new(),
            });
        }

        let agent = AcpAgent::from_str(trimmed).map_err(|err| err.to_string())?;
        match agent.server() {
            agent_client_protocol::schema::McpServer::Stdio(stdio) => Ok(Self {
                command: stdio.command.clone(),
                args: stdio.args.clone(),
            }),
            _ => Err("acp command must use stdio transport".into()),
        }
    }

    pub fn dev_default() -> Self {
        Self::from_acp_command("opensymphony-mock-acp-agent")
            .expect("valid default mock acp command")
    }
}

pub struct AcpClientAdapter {
    config: AcpClientConfig,
    db: Arc<Db>,
    permission_gate: Arc<PermissionGate>,
    handle: RuntimeHandle,
    sessions: Mutex<HashMap<String, Arc<Mutex<StoredSession>>>>,
}

impl AcpClientAdapter {
    pub fn new(
        config: AcpClientConfig,
        db: Arc<Db>,
        permission_gate: Arc<PermissionGate>,
        handle: RuntimeHandle,
    ) -> Self {
        Self {
            config,
            db,
            permission_gate,
            handle,
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn resolve_config(&self, input: &StartRuntimeSessionInput) -> Result<AcpClientConfig, String> {
        if let Some(command) = input
            .acp_command
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return AcpClientConfig::from_acp_command(command);
        }
        Ok(AcpClientConfig {
            command: self.config.command.clone(),
            args: self.config.args.clone(),
        })
    }

    fn ctx(&self, session_id: &str) -> Option<SessionCtx> {
        self.sessions
            .lock()
            .expect("acp adapter sessions lock")
            .get(session_id)
            .map(|stored| SessionCtx::new(Arc::clone(&self.db), Arc::clone(stored)))
    }

    fn spawn_agent_process(
        config: &AcpClientConfig,
        workspace: &str,
        input: &StartRuntimeSessionInput,
    ) -> Result<(tokio::process::ChildStdin, tokio::process::ChildStdout, Child), String> {
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .current_dir(workspace)
            .env("SYMPHONY_RUN_ATTEMPT_ID", &input.run_attempt_id)
            .env("SYMPHONY_ISSUE_ID", &input.issue_id)
            .env("SYMPHONY_ATTEMPT_NUMBER", input.attempt_number.to_string())
            .env("SYMPHONY_WORKSPACE_PATH", workspace)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|err| format!("spawn_error:{err}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "spawn_error:missing stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "spawn_error:missing stdout".to_string())?;

        Ok((stdin, stdout, child))
    }

    fn schedule_kill_fallback(&self, ctx: SessionCtx) {
        self.handle.spawn(async move {
            tokio::time::sleep(Duration::from_millis(CANCEL_SIGTERM_FALLBACK_MS)).await;
            ctx.with_mut(|session| {
                let Some(child) = session.child.as_mut() else {
                    return;
                };
                if child.try_wait().ok().flatten().is_some() {
                    return;
                }
                let _ = child.start_kill();
            });
        });
    }
}

impl AcpAdapter for AcpClientAdapter {
    fn start_session(&self, input: StartRuntimeSessionInput) -> RuntimeSessionRecord {
        let workspace = input.workspace_path.trim();
        if workspace.is_empty() {
            panic!("workspace_path is required for acp client sessions");
        }

        let config = self
            .resolve_config(&input)
            .unwrap_or_else(|err| panic!("invalid acp command: {err}"));

        let stored = Arc::new(Mutex::new(StoredSession {
            session_id: input.agent_session_id.clone(),
            run_attempt_id: input.run_attempt_id.clone(),
            issue_id: input.issue_id.clone(),
            attempt_number: input.attempt_number,
            agent_name: input.agent_name.clone(),
            started_at: input.started_at.clone(),
            finished_at: None,
            status: RuntimeSessionStatus::Running,
            error_message: None,
            phase: RuntimeSessionPhase::Spawning,
            agent_session_ref: None,
            cancelled: false,
            pause_gate: Arc::clone(&input.pause_gate),
            recorder: Recorder::new(),
            child: None,
        }));

        self.sessions
            .lock()
            .expect("acp adapter sessions lock")
            .insert(input.agent_session_id.clone(), Arc::clone(&stored));

        let ctx = SessionCtx::new(Arc::clone(&self.db), stored);
        let ctx_for_return = ctx.clone();
        let ctx_for_fail = ctx.clone();
        let permission_gate = Arc::clone(&self.permission_gate);

        self.handle.spawn(async move {
            if let Err(message) = run_session(ctx, config, permission_gate, input).await {
                ctx_for_fail.fail(message);
            }
        });

        ctx_for_return.record()
    }

    fn poll_sessions(&self, _now_iso: &str, session_ids: &[String]) -> Vec<RuntimeSessionRecord> {
        for session_id in session_ids {
            if let Some(ctx) = self.ctx(session_id) {
                ctx.poll();
            }
        }

        session_ids
            .iter()
            .filter_map(|session_id| self.ctx(session_id))
            .map(|ctx| ctx.record())
            .collect()
    }

    fn cancel_session(
        &self,
        session_id: &str,
        now_iso: &str,
        reason: &str,
    ) -> Option<RuntimeSessionRecord> {
        let ctx = self.ctx(session_id)?;
        if ctx.request_cancel(reason.into(), now_iso.into()) {
            self.schedule_kill_fallback(ctx.clone());
        }
        Some(ctx.record())
    }

    fn get_session_phase(&self, session_id: &str) -> Option<RuntimeSessionPhase> {
        self.ctx(session_id).map(|ctx| ctx.session_phase())
    }

    fn get_current_activity(&self, session_id: &str) -> Option<String> {
        self.ctx(session_id).map(|ctx| ctx.current_activity())
    }

    fn get_last_agent_message(&self, session_id: &str) -> Option<String> {
        self.ctx(session_id).and_then(|ctx| ctx.last_agent_message())
    }

    fn is_session_paused(&self, session_id: &str) -> bool {
        self.ctx(session_id)
            .map(|ctx| ctx.is_paused())
            .unwrap_or(false)
    }
}

async fn run_session(
    ctx: SessionCtx,
    config: AcpClientConfig,
    permission_gate: Arc<PermissionGate>,
    input: StartRuntimeSessionInput,
) -> Result<(), String> {
    let workspace = input.workspace_path.trim().to_string();
    let (session_id, issue_id) = ctx.with_mut(|session| {
        (
            session.session_id.clone(),
            session.issue_id.clone(),
        )
    });

    ctx.set_phase(RuntimeSessionPhase::Spawning);
    let (stdin, stdout, child) = AcpClientAdapter::spawn_agent_process(&config, &workspace, &input)?;
    ctx.set_child(child);

    let permissions_gate = Arc::clone(&permission_gate);
    let ctx_updates = ctx.clone();
    let ctx_permissions = ctx.clone();
    let on_session_update = Arc::new(move |notification: SessionNotification| {
        ctx_updates.handle_session_update(notification);
    });

    connect(
        ByteStreams::new(stdin.compat_write(), stdout.compat()),
        on_session_update,
        permission_handler(ctx_permissions, permissions_gate, session_id, issue_id),
        move |connection: ConnectionTo<Agent>| {
            let ctx = ctx.clone();
            let input = input.clone();
            let workspace = workspace.clone();
            async move { run_protocol(ctx, connection, input, workspace).await }
        },
    )
    .await
    .map_err(|err| err.to_string())
}

async fn run_protocol(
    ctx: SessionCtx,
    connection: ConnectionTo<Agent>,
    input: StartRuntimeSessionInput,
    workspace: String,
) -> Result<(), Error> {
    let mut cancel_sent = false;
    let mut agent_session_id = None;

    ctx.wait_pause().await;
    if exit_if_cancelled(&ctx, &connection, &agent_session_id, &mut cancel_sent).await? {
        return Ok(());
    }
    ctx.set_phase(RuntimeSessionPhase::Initializing);
    connection
        .send_request(default_initialize_request())
        .block_task()
        .await?;

    ctx.wait_pause().await;
    if exit_if_cancelled(&ctx, &connection, &agent_session_id, &mut cancel_sent).await? {
        return Ok(());
    }
    ctx.set_phase(RuntimeSessionPhase::Prompting);
    let agent_session = connection
        .send_request(NewSessionRequest::new(&workspace))
        .block_task()
        .await?;
    agent_session_id = Some(agent_session.session_id.clone());
    let agent_session_ref = agent_session.session_id.to_string();

    ctx.with_mut(|session| session.agent_session_ref = Some(agent_session_ref.clone()));
    let session_id = ctx.with_mut(|session| session.session_id.clone());
    {
        let conn = ctx
            .db
            .conn()
            .map_err(|err| Error::into_internal_error(err))?;
        AgentSessionRepo::new(&conn)
            .set_session_ref(&session_id, &agent_session_ref)
            .map_err(|err| Error::into_internal_error(err))?;
    }

    let prompt_text = render_task_prompt(&input)
        .map_err(|message| agent_client_protocol::util::internal_error(message))?;
    ctx.append_event(SessionEventKind::Prompt, json!({ "text": prompt_text }));

    ctx.wait_pause().await;
    if exit_if_cancelled(&ctx, &connection, &agent_session_id, &mut cancel_sent).await? {
        return Ok(());
    }
    ctx.set_phase(RuntimeSessionPhase::Streaming);
    let prompt_result = connection
        .send_request(PromptRequest::new(
            agent_session.session_id,
            vec![ContentBlock::Text(TextContent::new(prompt_text))],
        ))
        .block_task()
        .await?;

    if ctx.with_mut(|session| session.cancelled) {
        return Ok(());
    }

    ctx.complete_from_stop_reason(prompt_result.stop_reason);
    Ok(())
}

async fn exit_if_cancelled(
    ctx: &SessionCtx,
    connection: &ConnectionTo<Agent>,
    agent_session_id: &Option<SessionId>,
    cancel_sent: &mut bool,
) -> Result<bool, Error> {
    if !ctx.with_mut(|session| session.cancelled) {
        return Ok(false);
    }
    if !*cancel_sent {
        if let Some(session_id) = agent_session_id {
            let _ = connection.send_notification(CancelNotification::new(session_id.clone()));
        }
        *cancel_sent = true;
    }
    Ok(true)
}


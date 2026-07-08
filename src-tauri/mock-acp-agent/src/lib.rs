//! standalone acp mock agent process over stdio ndjson.
use std::collections::HashMap;

use agent_client_protocol::schema::{
    AgentCapabilities, CancelNotification, ContentBlock, ContentChunk, InitializeRequest,
    InitializeResponse, NewSessionRequest, NewSessionResponse, PermissionOption,
    PermissionOptionId, PermissionOptionKind, PromptRequest, PromptResponse,
    RequestPermissionRequest, SessionId, SessionNotification, SessionUpdate, StopReason,
    TextContent, ToolCall, ToolCallId, ToolCallStatus, ToolCallUpdate, ToolCallUpdateFields,
    ToolKind,
};
use agent_client_protocol::{Agent, ByteStreams, Client, ConnectionTo, Error, Result};
use tokio::sync::Mutex;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

#[derive(Debug, Default)]
struct SessionState {
    cancelled: bool,
}

type SessionStore = std::sync::Arc<Mutex<HashMap<SessionId, SessionState>>>;

pub fn run() -> anyhow::Result<()> {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?
        .block_on(run_agent())
}

async fn run_agent() -> anyhow::Result<()> {
    let sessions: SessionStore = std::sync::Arc::new(Mutex::new(HashMap::new()));

    Agent
        .builder()
        .name("opensymphony-mock-acp-agent")
        .on_receive_request(
            async |initialize: InitializeRequest, responder, _connection| {
                responder.respond(
                    InitializeResponse::new(initialize.protocol_version)
                        .agent_capabilities(AgentCapabilities::new()),
                )
            },
            agent_client_protocol::on_receive_request!(),
        )
        .on_receive_request(
            {
                let sessions = std::sync::Arc::clone(&sessions);
                async move |request: NewSessionRequest, responder, _connection| {
                    let _ = request;
                    let session_id =
                        SessionId::new(uuid::Uuid::new_v4().to_string());
                    sessions
                        .lock()
                        .await
                        .insert(session_id.clone(), SessionState::default());
                    responder.respond(NewSessionResponse::new(session_id))
                }
            },
            agent_client_protocol::on_receive_request!(),
        )
        .on_receive_request(
            {
                let sessions = std::sync::Arc::clone(&sessions);
                async move |request: PromptRequest, responder, connection: ConnectionTo<Client>| {
                    handle_prompt(request, responder, connection, &sessions).await
                }
            },
            agent_client_protocol::on_receive_request!(),
        )
        .on_receive_notification(
            {
                let sessions = std::sync::Arc::clone(&sessions);
                async move |notification: CancelNotification, _connection| {
                    if let Some(session) = sessions.lock().await.get_mut(&notification.session_id) {
                        session.cancelled = true;
                    }
                    Ok(())
                }
            },
            agent_client_protocol::on_receive_notification!(),
        )
        .connect_to(ByteStreams::new(
            tokio::io::stdout().compat_write(),
            tokio::io::stdin().compat(),
        ))
        .await?;

    Ok(())
}

async fn handle_prompt(
    request: PromptRequest,
    responder: agent_client_protocol::Responder<PromptResponse>,
    connection: ConnectionTo<Client>,
    sessions: &SessionStore,
) -> Result<()> {
    {
        let store = sessions.lock().await;
        let Some(session) = store.get(&request.session_id) else {
            return responder.respond_with_error(
                Error::invalid_params().data(format!("unknown session {}", request.session_id)),
            );
        };

        if session.cancelled {
            return responder.respond(PromptResponse::new(StopReason::Cancelled));
        }
    }

    if mock_permission_enabled() {
        connection
            .send_request(permission_request(request.session_id.clone()))
            .block_task()
            .await?;
    } else {
        emit_happy_path_updates(&connection, &request)?;
    }

    if sessions
        .lock()
        .await
        .get(&request.session_id)
        .is_some_and(|session| session.cancelled)
    {
        return responder.respond(PromptResponse::new(StopReason::Cancelled));
    }

    responder.respond(PromptResponse::new(StopReason::EndTurn))
}

fn prompt_text_length(request: &PromptRequest) -> usize {
    request
        .prompt
        .iter()
        .map(|block| match block {
            ContentBlock::Text(text) => text.text.chars().count(),
            _ => 0,
        })
        .sum()
}

fn emit_happy_path_updates(
    connection: &ConnectionTo<Client>,
    request: &PromptRequest,
) -> Result<()> {
    let session_id = request.session_id.clone();
    let prompt_len = prompt_text_length(request);

    connection.send_notification(SessionNotification::new(
        session_id.clone(),
        SessionUpdate::AgentMessageChunk(ContentChunk::new(ContentBlock::Text(
            TextContent::new(format!("received task ({prompt_len} chars)")),
        ))),
    ))?;

    connection.send_notification(SessionNotification::new(
        session_id.clone(),
        SessionUpdate::ToolCall(
            ToolCall::new(ToolCallId::new("tool-demo-1"), "demo tool").kind(ToolKind::Execute),
        ),
    ))?;

    connection.send_notification(SessionNotification::new(
        session_id,
        SessionUpdate::AgentMessageChunk(ContentChunk::new(ContentBlock::Text(
            TextContent::new("demo acp agent: done"),
        ))),
    ))?;

    Ok(())
}

fn mock_permission_enabled() -> bool {
    matches!(
        std::env::var("SYMPHONY_MOCK_PERMISSION").ok().as_deref(),
        Some("1") | Some("true") | Some("yes")
    )
}

fn permission_request(session_id: SessionId) -> RequestPermissionRequest {
    let tool_call = ToolCallUpdate::new(
        ToolCallId::new("tool-perm-1"),
        ToolCallUpdateFields::new()
            .title("Run tests")
            .kind(ToolKind::Execute)
            .status(ToolCallStatus::Pending),
    );

    RequestPermissionRequest::new(
        session_id,
        tool_call,
        vec![
            PermissionOption::new(
                PermissionOptionId::new("allow-once"),
                "Allow once",
                PermissionOptionKind::AllowOnce,
            ),
            PermissionOption::new(
                PermissionOptionId::new("reject-once"),
                "Reject",
                PermissionOptionKind::RejectOnce,
            ),
        ],
    )
}

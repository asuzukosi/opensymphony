//! permission gate: route acp requests in memory, block until resolve.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use agent_client_protocol::schema::{
    PermissionOptionKind, RequestPermissionOutcome, RequestPermissionRequest,
    RequestPermissionResponse, SelectedPermissionOutcome,
};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use crate::types::{PendingPermission, PermissionDecision, SessionEventKind};
use super::context::SessionCtx;

pub type RequestPermissionFn = Arc<
    dyn Fn(RequestPermissionRequest) -> Pin<Box<dyn Future<Output = RequestPermissionResponse> + Send>>
        + Send
        + Sync,
>;

struct PendingEntry {
    permission: PendingPermission,
    request: RequestPermissionRequest,
    sender: tokio::sync::oneshot::Sender<RequestPermissionResponse>,
}

pub struct PermissionGate {
    pending: Mutex<HashMap<String, PendingEntry>>,
}

impl PermissionGate {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
        }
    }

    pub fn list_by_task(&self, task_id: &str) -> Vec<PendingPermission> {
        self.pending
            .lock()
            .expect("permission gate lock")
            .values()
            .filter(|entry| entry.permission.task_id == task_id)
            .map(|entry| entry.permission.clone())
            .collect()
    }

    pub async fn route(
        &self,
        session_id: &str,
        task_id: &str,
        request: RequestPermissionRequest,
    ) -> Result<RequestPermissionResponse, String> {
        let summary = request
            .tool_call
            .fields
            .title
            .as_deref()
            .map(str::trim)
            .filter(|title| !title.is_empty())
            .unwrap_or("permission requested")
            .to_string();
        let permission_id = Uuid::new_v4().to_string();
        let permission = PendingPermission {
            id: permission_id.clone(),
            session_id: session_id.to_string(),
            task_id: task_id.to_string(),
            summary,
            created_at: Utc::now()
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
        };

        let (sender, receiver) = tokio::sync::oneshot::channel();
        self.pending.lock().expect("permission gate lock").insert(
            permission_id,
            PendingEntry {
                permission,
                request,
                sender,
            },
        );

        receiver
            .await
            .map_err(|_| "permission decision channel closed".into())
    }

    pub fn resolve(&self, id: &str, decision: PermissionDecision) -> bool {
        let Some(entry) = self.pending.lock().expect("permission gate lock").remove(id) else {
            return false;
        };
        entry
            .sender
            .send(build_response(&entry.request, decision))
            .is_ok()
    }
}

pub fn permission_handler(
    ctx: SessionCtx,
    gate: Arc<PermissionGate>,
    session_id: String,
    task_id: String,
    auto_approve: bool,
) -> RequestPermissionFn {
    Arc::new(move |request| {
        let ctx = ctx.clone();
        let gate = Arc::clone(&gate);
        let session_id = session_id.clone();
        let task_id = task_id.clone();
        Box::pin(async move {
            ctx.wait_pause().await;
            if auto_approve {
                return approve_request(&request);
            }

            let payload = serde_json::to_value(&request).unwrap_or(json!({}));
            ctx.append_event(SessionEventKind::PermissionRequest, payload);
            let fallback = approve_request(&request);
            let response = gate
                .route(&session_id, &task_id, request)
                .await
                .unwrap_or(fallback);
            ctx.wait_pause().await;
            response
        })
    })
}

fn approve_request(request: &RequestPermissionRequest) -> RequestPermissionResponse {
    build_response(request, PermissionDecision::Approve)
}

fn build_response(
    request: &RequestPermissionRequest,
    decision: PermissionDecision,
) -> RequestPermissionResponse {
    let kinds = match decision {
        PermissionDecision::Approve => [
            PermissionOptionKind::AllowOnce,
            PermissionOptionKind::AllowAlways,
        ],
        PermissionDecision::Deny => [
            PermissionOptionKind::RejectOnce,
            PermissionOptionKind::RejectAlways,
        ],
    };

    let option = kinds
        .into_iter()
        .find_map(|kind| request.options.iter().find(|option| option.kind == kind))
        .or_else(|| request.options.first());

    match option {
        Some(option) => RequestPermissionResponse::new(RequestPermissionOutcome::Selected(
            SelectedPermissionOutcome::new(option.option_id.clone()),
        )),
        None => RequestPermissionResponse::new(RequestPermissionOutcome::Cancelled),
    }
}

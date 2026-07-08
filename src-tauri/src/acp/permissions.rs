//! permission gate: route acp requests, persist pending rows, block until resolve.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use agent_client_protocol::schema::{
    PermissionOptionKind, RequestPermissionOutcome, RequestPermissionRequest,
    RequestPermissionResponse, SelectedPermissionOutcome,
};
use serde_json::json;

use crate::db::repos::pending_permission::PendingPermissionRepo;
use crate::db::{Db, DbError, DbResult};
use crate::types::{PermissionDecision, PermissionMode, SessionEventKind};
use super::context::SessionCtx;

pub type RequestPermissionFn = Arc<
    dyn Fn(RequestPermissionRequest) -> Pin<Box<dyn Future<Output = RequestPermissionResponse> + Send>>
        + Send
        + Sync,
>;

struct PendingEntry {
    request: RequestPermissionRequest,
    sender: tokio::sync::oneshot::Sender<RequestPermissionResponse>,
}

pub struct PermissionGate {
    db: Arc<Db>,
    mode: Mutex<PermissionMode>,
    pending: Mutex<HashMap<String, PendingEntry>>,
}

impl PermissionGate {
    pub fn new(db: Arc<Db>) -> Self {
        Self {
            db,
            mode: Mutex::new(PermissionMode::RequiresApproval),
            pending: Mutex::new(HashMap::new()),
        }
    }

    pub fn mode(&self) -> PermissionMode {
        *self.mode.lock().expect("permission gate lock")
    }

    pub fn set_mode(&self, mode: PermissionMode) {
        *self.mode.lock().expect("permission gate lock") = mode;
    }

    pub async fn route(
        &self,
        session_id: &str,
        issue_id: &str,
        request: RequestPermissionRequest,
    ) -> DbResult<RequestPermissionResponse> {
        if self.mode() == PermissionMode::AutoApprove {
            return Ok(build_response(&request, PermissionDecision::Approve));
        }

        let summary = request
            .tool_call
            .fields
            .title
            .as_deref()
            .map(str::trim)
            .filter(|title| !title.is_empty())
            .unwrap_or("permission requested")
            .to_string();
        let payload_json = serde_json::to_string(&request)
            .map_err(|err| DbError::Internal(err.to_string()))?;

        let permission_id = {
            let conn = self.db.conn()?;
            PendingPermissionRepo::new(&conn)
                .insert(session_id, issue_id, &summary, &payload_json)?
                .id
        };

        let (sender, receiver) = tokio::sync::oneshot::channel();
        self.pending.lock().expect("permission gate lock").insert(
            permission_id,
            PendingEntry { request, sender },
        );

        receiver
            .await
            .map_err(|_| DbError::Internal("permission decision channel closed".into()))
    }

    pub fn resolve(&self, id: &str, decision: PermissionDecision) -> bool {
        self.complete(id, |request| build_response(request, decision))
    }

    pub fn cancel(&self, id: &str) -> bool {
        self.complete(id, |_| {
            RequestPermissionResponse::new(RequestPermissionOutcome::Cancelled)
        })
    }

    fn complete(
        &self,
        id: &str,
        response: impl FnOnce(&RequestPermissionRequest) -> RequestPermissionResponse,
    ) -> bool {
        let Some(entry) = self.pending.lock().expect("permission gate lock").remove(id) else {
            return false;
        };
        entry.sender.send(response(&entry.request)).is_ok()
    }
}

pub fn permission_handler(
    ctx: SessionCtx,
    gate: Arc<PermissionGate>,
    session_id: String,
    issue_id: String,
) -> RequestPermissionFn {
    Arc::new(move |request| {
        let ctx = ctx.clone();
        let gate = Arc::clone(&gate);
        let session_id = session_id.clone();
        let issue_id = issue_id.clone();
        Box::pin(async move {
            ctx.wait_pause().await;
            let payload = serde_json::to_value(&request).unwrap_or(json!({}));
            ctx.append_event(SessionEventKind::PermissionRequest, payload);
            let fallback = approve_request(&request);
            let response = gate
                .route(&session_id, &issue_id, request)
                .await
                .unwrap_or(fallback);
            ctx.wait_pause().await;
            response
        })
    })
}

pub fn approve_request(request: &RequestPermissionRequest) -> RequestPermissionResponse {
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

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use agent_client_protocol::schema::{
        PermissionOption, PermissionOptionId, PermissionOptionKind, RequestPermissionOutcome,
        RequestPermissionRequest, SelectedPermissionOutcome, SessionId, ToolCallId,
        ToolCallStatus, ToolCallUpdate, ToolCallUpdateFields, ToolKind,
    };

    use crate::db::repos::pending_permission::PendingPermissionRepo;
    use crate::db::test_helpers::seed_issue_with_session;
    use crate::db::Db;

    use super::*;

    #[tokio::test]
    async fn requires_approval_persists_and_unblocks_on_resolve() {
        let path = PathBuf::from(std::env::temp_dir()).join(format!(
            "symphony-gate-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("epoch")
                .as_nanos()
        ));
        let db = Arc::new(Db::open(&path).expect("open database"));
        let fixtures = {
            let conn = db.conn().expect("lock connection");
            seed_issue_with_session(&conn).expect("seed session")
        };

        let gate = Arc::new(PermissionGate::new(Arc::clone(&db)));
        let handle = tokio::spawn({
            let gate = Arc::clone(&gate);
            let session_id = fixtures.session_id.clone();
            let issue_id = fixtures.issue_id.clone();
            async move {
                gate.route(
                    &session_id,
                    &issue_id,
                    RequestPermissionRequest::new(
                        SessionId::new("acp-session-1"),
                        ToolCallUpdate::new(
                            ToolCallId::new("tool-1"),
                            ToolCallUpdateFields::new()
                                .title("Run tests")
                                .kind(ToolKind::Execute)
                                .status(ToolCallStatus::Pending),
                        ),
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
                    ),
                )
                .await
            }
        });

        tokio::task::yield_now().await;

        let conn = db.conn().expect("lock connection");
        let pending = PendingPermissionRepo::new(&conn)
            .list_by_issue(&fixtures.issue_id)
            .expect("list pending permissions");
        assert_eq!(pending.len(), 1);
        assert!(gate.resolve(&pending[0].id, PermissionDecision::Deny));

        let response = handle.await.expect("join route task").expect("permission decision");
        assert_eq!(
            response.outcome,
            RequestPermissionOutcome::Selected(SelectedPermissionOutcome::new(
                PermissionOptionId::new("reject-once")
            ))
        );

        let _ = std::fs::remove_file(path);
    }
}

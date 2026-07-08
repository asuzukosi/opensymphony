//! permission gate: route acp requests, persist pending rows, block until resolve.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use agent_client_protocol::schema::{
    PermissionOptionKind, RequestPermissionOutcome, RequestPermissionRequest,
    RequestPermissionResponse, SelectedPermissionOutcome,
};
use rusqlite::Connection;
use serde_json::json;

use crate::db::repos::issue::IssueRepo;
use crate::db::repos::pending_permission::PendingPermissionRepo;
use crate::db::repos::project::ProjectRepo;
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
    project_modes: Mutex<HashMap<String, PermissionMode>>,
    pending: Mutex<HashMap<String, PendingEntry>>,
}

impl PermissionGate {
    pub fn new(db: Arc<Db>) -> Self {
        Self {
            db,
            project_modes: Mutex::new(HashMap::new()),
            pending: Mutex::new(HashMap::new()),
        }
    }

    pub fn sync_project_mode(&self, project_id: &str, mode: PermissionMode) {
        self.project_modes
            .lock()
            .expect("permission gate lock")
            .insert(project_id.to_string(), mode);
    }

    fn project_mode(&self, project_id: &str) -> PermissionMode {
        self.project_modes
            .lock()
            .expect("permission gate lock")
            .get(project_id)
            .copied()
            .unwrap_or(PermissionMode::RequiresApproval)
    }

    pub fn hydrate_project_modes(&self, conn: &Connection) -> DbResult<()> {
        let mut modes = self.project_modes.lock().expect("permission gate lock");
        modes.clear();
        for (project_id, permission_mode) in ProjectRepo::new(conn).list_permission_modes()? {
            modes.insert(project_id, permission_mode);
        }
        Ok(())
    }

    pub async fn route(
        &self,
        session_id: &str,
        issue_id: &str,
        request: RequestPermissionRequest,
    ) -> DbResult<RequestPermissionResponse> {
        if self.mode_for_issue(issue_id)? == PermissionMode::AutoApprove {
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

    fn mode_for_issue(&self, issue_id: &str) -> DbResult<PermissionMode> {
        let conn = self.db.conn()?;
        let Some(issue) = IssueRepo::new(&conn).get(issue_id)? else {
            return Ok(PermissionMode::RequiresApproval);
        };
        Ok(self.project_mode(&issue.project_id))
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


//! persist acp session timeline events via SessionEventRepo.

use std::sync::Arc;

use serde_json::{json, Value};

use crate::db::error::DbResult;
use crate::db::repos::session_event::SessionEventRepo;
use crate::db::Db;
use crate::types::SessionEventKind;

use super::types::RuntimeSessionStatus;

pub(crate) fn append(
    db: &Arc<Db>,
    session_id: &str,
    kind: SessionEventKind,
    payload: Value,
) -> DbResult<()> {
    let conn = db.conn()?;
    SessionEventRepo::new(&conn).append(session_id, kind.as_str(), &payload.to_string())?;
    Ok(())
}

pub(crate) fn append_terminal(
    db: &Arc<Db>,
    session_id: &str,
    status: RuntimeSessionStatus,
    error_message: Option<&str>,
) -> DbResult<()> {
    append(
        db,
        session_id,
        SessionEventKind::Terminal,
        json!({
            "status": status.as_str(),
            "errorMessage": error_message,
        }),
    )
}


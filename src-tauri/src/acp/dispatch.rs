//! dispatch helpers: resolve issue executor to platform acp command.
use std::str::FromStr;
use rusqlite::Connection;
use crate::db::error::{DbError, DbResult};
use crate::db::repos::issue::IssueRepo;
use crate::db::repos::platforms::PlatformsRepo;
use crate::types::Platform;

pub struct DispatchTarget {
    pub label: String,
    pub acp_command: String,
}

pub fn resolve_dispatch_for_issue(
    conn: &Connection,
    issue_id: &str,
) -> DbResult<Option<DispatchTarget>> {
    let issue = IssueRepo::new(conn)
        .get(issue_id)?
        .ok_or_else(|| DbError::NotFound(format!("issue {issue_id}")))?;

    let Some(executor) = issue
        .executor
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };

    let platform = Platform::from_str(executor).map_err(DbError::Internal)?;
    if !PlatformsRepo::new(conn).is_connected(&issue.project_id, platform.as_str())? {
        return Ok(None);
    }

    Ok(Some(DispatchTarget {
        label: platform.display_name().into(),
        acp_command: platform.acp_command().into(),
    }))
}

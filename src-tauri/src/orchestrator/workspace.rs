use std::path::{Path, PathBuf};

use crate::db::error::DbResult;

pub struct WorkspaceManager {
    root: PathBuf,
}

impl WorkspaceManager {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn from_app_data(app_data_dir: &Path) -> Self {
        Self::new(app_data_dir.join("workspaces"))
    }

    pub fn workspace_path(&self, project_id: &str, issue_id: &str) -> PathBuf {
        self.root.join(project_id).join(issue_id)
    }

    pub fn ensure_workspace(
        &self,
        project_id: &str,
        issue_id: &str,
    ) -> DbResult<PathBuf> {
        let workspace_path = self.workspace_path(project_id, issue_id);
        std::fs::create_dir_all(&workspace_path).map_err(|err| {
            crate::db::error::DbError::Internal(err.to_string())
        })?;
        Ok(workspace_path)
    }

    pub fn remove_workspace(&self, project_id: &str, issue_id: &str) -> DbResult<()> {
        let workspace_path = self.workspace_path(project_id, issue_id);
        if workspace_path.exists() {
            std::fs::remove_dir_all(&workspace_path).map_err(|err| {
                crate::db::error::DbError::Internal(err.to_string())
            })?;
        }
        Ok(())
    }
}

pub(crate) fn cleanup_done_workspaces(
    issues: &crate::db::repos::issue::IssueRepo<'_>,
    workspaces: &WorkspaceManager,
    project_id: &str,
) -> DbResult<u32> {
    let mut cleaned = 0u32;
    for issue in issues.list_by_column(project_id, crate::types::BoardColumnId::Done)? {
        workspaces.remove_workspace(project_id, &issue.issue_id)?;
        cleaned = cleaned.saturating_add(1);
    }
    Ok(cleaned)
}

use std::path::{Path, PathBuf};
use std::process::Command;
use crate::db::error::{DbError, DbResult};
use crate::types::Project;
use crate::utils::{binary_path, user_path_for_spawn};

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

    pub fn ensure_workspace(&self, project: &Project, issue_id: &str) -> DbResult<PathBuf> {
        let sandbox = self.workspace_path(&project.id, issue_id);
        let workspace_root = Path::new(project.workspace_root.trim());

        if project.use_worktrees {
            ensure_worktree_workspace(workspace_root, &sandbox, issue_id)
        } else {
            ensure_copy_workspace(workspace_root, &sandbox)
        }
    }

    pub fn remove_workspace(&self, project_id: &str, issue_id: &str) -> DbResult<()> {
        let workspace_path = self.workspace_path(project_id, issue_id);
        if workspace_path.exists() {
            std::fs::remove_dir_all(&workspace_path).map_err(|err| {
                DbError::Internal(format!(
                    "failed to remove workspace {}: {err}",
                    workspace_path.display()
                ))
            })?;
        }
        Ok(())
    }
}

pub fn resolve_dispatch_cwd(
    workspaces: &WorkspaceManager,
    project: &Project,
    issue_id: &str,
) -> DbResult<Option<PathBuf>> {
    let workspace_root = project.workspace_root.trim();
    if workspace_root.is_empty() || !Path::new(workspace_root).is_dir() {
        log::warn!(
            "skip dispatch for issue {issue_id}: workspace_root missing at {workspace_root}"
        );
        return Ok(None);
    }
    if project.use_per_issue_workspaces {
        match workspaces.ensure_workspace(project, issue_id) {
            Ok(path) => Ok(Some(path)),
            Err(err) => {
                log::warn!("skip dispatch for issue {issue_id}: {err}");
                Ok(None)
            }
        }
    } else {
        Ok(Some(PathBuf::from(workspace_root)))
    }
}

pub(crate) fn cleanup_done_workspaces(
    issues: &crate::db::repos::issue::IssueRepo<'_>,
    workspaces: &WorkspaceManager,
    project: &Project,
) -> DbResult<u32> {
    if !project.use_per_issue_workspaces {
        return Ok(0);
    }

    let mut cleaned = 0u32;
    for issue in issues.list_by_column(&project.id, crate::types::BoardColumnId::Done)? {
        workspaces.remove_workspace(&project.id, &issue.issue_id)?;
        cleaned = cleaned.saturating_add(1);
    }
    Ok(cleaned)
}

fn ensure_copy_workspace(workspace_root: &Path, sandbox: &Path) -> DbResult<PathBuf> {
    if sandbox.is_dir() {
        return Ok(sandbox.to_path_buf());
    }

    copy_dir_all(workspace_root, sandbox).map_err(|err| {
        DbError::Internal(format!(
            "failed to copy workspace {} to {}: {err}",
            workspace_root.display(),
            sandbox.display()
        ))
    })?;
    Ok(sandbox.to_path_buf())
}

fn ensure_worktree_workspace(
    workspace_root: &Path,
    sandbox: &Path,
    issue_id: &str,
) -> DbResult<PathBuf> {
    if binary_path("git").is_none() {
        return Err(DbError::Internal(
            "git not found on PATH; install git or disable worktrees".into(),
        ));
    }

    if !workspace_root.join(".git").exists() {
        return Err(DbError::Internal(format!(
            "workspace_root {} is not a git repository; run git init or disable worktrees",
            workspace_root.display()
        )));
    }

    if is_valid_worktree(sandbox) {
        return Ok(sandbox.to_path_buf());
    }

    remove_stale_worktree(workspace_root, sandbox)?;

    let branch = worktree_branch_name(issue_id);
    let sandbox_arg = path_arg(sandbox)?;
    if let Some(parent) = sandbox.parent() {
        std::fs::create_dir_all(parent).map_err(|err| {
            DbError::Internal(format!(
                "failed to create sandbox parent {}: {err}",
                parent.display()
            ))
        })?;
    }

    let create_branch = run_git(
        workspace_root,
        &["worktree", "add", &sandbox_arg, "-b", &branch],
    )?;
    if create_branch.status.success() {
        return Ok(sandbox.to_path_buf());
    }

    let attach_branch = run_git(
        workspace_root,
        &["worktree", "add", &sandbox_arg, &branch],
    )?;
    if attach_branch.status.success() {
        return Ok(sandbox.to_path_buf());
    }

    Err(DbError::Internal(format!(
        "git worktree add failed: {}",
        git_stderr(&attach_branch)
    )))
}

fn worktree_branch_name(issue_id: &str) -> String {
    format!("opensymphony/{issue_id}")
}

fn path_arg(path: &Path) -> DbResult<String> {
    path.to_str()
        .map(str::to_string)
        .ok_or_else(|| DbError::Internal(format!("path is not valid utf-8: {}", path.display())))
}

fn is_valid_worktree(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    let Some(git) = binary_path("git") else {
        return false;
    };
    Command::new(&git)
        .env("PATH", user_path_for_spawn())
        .arg("-C")
        .arg(path)
        .arg("rev-parse")
        .arg("--is-inside-work-tree")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn remove_stale_worktree(workspace_root: &Path, sandbox: &Path) -> DbResult<()> {
    if !sandbox.exists() {
        return Ok(());
    }

    if let Ok(sandbox_arg) = path_arg(sandbox) {
        let _ = run_git(
            workspace_root,
            &["worktree", "remove", &sandbox_arg, "--force"],
        );
    }

    if sandbox.exists() {
        std::fs::remove_dir_all(sandbox).map_err(|err| {
            DbError::Internal(format!(
                "failed to remove stale worktree {}: {err}",
                sandbox.display()
            ))
        })?;
    }

    let _ = run_git(workspace_root, &["worktree", "prune"]);
    Ok(())
}

fn run_git(cwd: &Path, args: &[&str]) -> DbResult<std::process::Output> {
    let git = binary_path("git").ok_or_else(|| {
        DbError::Internal("git not found on PATH; install git or disable worktrees".into())
    })?;
    Command::new(&git)
        .current_dir(cwd)
        .env("PATH", user_path_for_spawn())
        .args(args)
        .output()
        .map_err(|err| DbError::Internal(format!("failed to run git: {err}")))
}

fn git_stderr(output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let trimmed = stderr.trim();
    if trimmed.is_empty() {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
        trimmed.to_string()
    }
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let target = dst.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_all(&entry.path(), &target)?;
        } else {
            std::fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn temp_dir(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!("opensymphony-{label}-{}", Uuid::new_v4()))
    }

    #[test]
    fn copy_workspace_reuses_existing_sandbox() {
        let source = temp_dir("source");
        let sandbox_root = temp_dir("sandboxes");
        std::fs::create_dir_all(&source).expect("create source");
        std::fs::write(source.join("marker.txt"), "v1").expect("write marker");

        let project = Project {
            id: "copy-project".into(),
            name: "Copy Project".into(),
            slug: "copy-project".into(),
            workspace_root: source.to_string_lossy().into_owned(),
            prompt_template: String::new(),
            max_concurrency: 1,
            retry_max_attempts: 3,
            retry_backoff_ms: 1_000,
            use_per_issue_workspaces: true,
            use_worktrees: false,
            orchestrator_status: "idle".into(),
            created_at: String::new(),
            updated_at: String::new(),
        };

        let workspaces = WorkspaceManager::new(&sandbox_root);
        let first = workspaces
            .ensure_workspace(&project, "issue-a")
            .expect("first ensure");
        assert_eq!(
            std::fs::read_to_string(first.join("marker.txt")).expect("read sandbox marker"),
            "v1"
        );

        std::fs::write(source.join("marker.txt"), "v2").expect("update source marker");
        let second = workspaces
            .ensure_workspace(&project, "issue-a")
            .expect("second ensure");
        assert_eq!(first, second);
        assert_eq!(
            std::fs::read_to_string(second.join("marker.txt")).expect("read reused marker"),
            "v1"
        );
    }
}

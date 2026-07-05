use crate::stubs::issue;
use crate::types::IssueDetail;

#[tauri::command]
pub fn get_issue(issue_id: String, attempt_limit: Option<u32>) -> Result<IssueDetail, String> {
    let _ = attempt_limit;
    issue::sample_issue_detail(&issue_id)
        .ok_or_else(|| format!("issue not found: {issue_id}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_stub_issue_with_empty_comments_and_attempts() {
        let detail = get_issue("stub-issue-1".into(), None).expect("issue should exist");

        assert_eq!(detail.identifier, "SYM-1");
        assert_eq!(detail.workflow_state_id, "backlog");
        assert!(detail.comments.is_empty());
        assert!(detail.attempts.is_empty());
    }

    #[test]
    fn returns_error_for_unknown_issue() {
        let error = get_issue("missing".into(), Some(10)).unwrap_err();
        assert!(error.contains("issue not found: missing"));
    }
}

use crate::stubs::issue;
use crate::types::{IssueDetail, MutateIssueRequest};

#[tauri::command]
pub fn get_issue(issue_id: String, attempt_limit: Option<u32>) -> Result<IssueDetail, String> {
    let _ = attempt_limit;
    issue::sample_issue_detail(&issue_id)
        .ok_or_else(|| format!("issue not found: {issue_id}"))
}

#[tauri::command]
pub fn mutate_issue(request: MutateIssueRequest) -> Result<(), String> {
    let _ = request;
    Ok(())
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

    #[test]
    fn mutate_issue_is_no_op_for_all_actions() {
        assert!(mutate_issue(MutateIssueRequest::Transition {
            issue_id: "stub-issue-1".into(),
            target_state_id: "in_progress".into(),
            actor: None,
        })
        .is_ok());

        assert!(mutate_issue(MutateIssueRequest::Comment {
            issue_id: "stub-issue-1".into(),
            body: "looks good".into(),
            author: Some("operator".into()),
        })
        .is_ok());

        assert!(mutate_issue(MutateIssueRequest::Create {
            project_id: "stub-project".into(),
            title: "New issue".into(),
            description: None,
            priority: None,
            workflow_state_id: None,
        })
        .is_ok());

        assert!(mutate_issue(MutateIssueRequest::Update {
            issue_id: "stub-issue-1".into(),
            title: Some("Updated title".into()),
            description: None,
            priority: None,
        })
        .is_ok());
    }

    #[test]
    fn mutate_issue_deserializes_transition_payload() {
        let request: MutateIssueRequest = serde_json::from_str(
            r#"{"action":"transition","issueId":"stub-issue-1","targetStateId":"done"}"#,
        )
        .expect("transition payload should deserialize");

        assert!(matches!(
            request,
            MutateIssueRequest::Transition {
                issue_id,
                target_state_id,
                actor: None,
            } if issue_id == "stub-issue-1" && target_state_id == "done"
        ));
    }
}

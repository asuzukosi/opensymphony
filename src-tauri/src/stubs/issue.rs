use crate::stubs::constants::STUB_PROJECT_ID;
use crate::types::IssueDetail;

pub fn sample_issue_detail(issue_id: &str) -> Option<IssueDetail> {
    match issue_id {
        "stub-issue-1" => Some(IssueDetail {
            issue_id: issue_id.into(),
            project_id: STUB_PROJECT_ID.into(),
            identifier: "SYM-1".into(),
            title: "Sample backlog issue".into(),
            description: Some("Stub backlog issue for development.".into()),
            priority: Some(2),
            workflow_state_id: "backlog".into(),
            workflow_state_name: "Backlog".into(),
            comments: Vec::new(),
            attempts: Vec::new(),
        }),
        "stub-issue-2" => Some(IssueDetail {
            issue_id: issue_id.into(),
            project_id: STUB_PROJECT_ID.into(),
            identifier: "SYM-2".into(),
            title: "Sample active issue".into(),
            description: None,
            priority: Some(1),
            workflow_state_id: "in_progress".into(),
            workflow_state_name: "In Progress".into(),
            comments: Vec::new(),
            attempts: Vec::new(),
        }),
        _ => None,
    }
}

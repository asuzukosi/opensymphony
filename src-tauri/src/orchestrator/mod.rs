mod pause_gate;
mod project_manager;
mod project_runtime;
mod types;

pub use project_manager::ProjectManager;
pub use project_runtime::ProjectRuntime;
pub use types::{OrchestratorError, Result};

#[cfg(test)]
mod tests {
    use super::OrchestratorError;

    #[test]
    fn orchestrator_error_formats() {
        let err = OrchestratorError::NotFound("project p1".into());
        assert!(err.to_string().contains("project p1"));
    }
}

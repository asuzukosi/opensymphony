mod types;

pub use types::OrchestratorError;

#[cfg(test)]
mod tests {
    use super::OrchestratorError;

    #[test]
    fn orchestrator_error_formats() {
        let err = OrchestratorError::NotFound("project p1".into());
        assert!(err.to_string().contains("project p1"));
    }
}

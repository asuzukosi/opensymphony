use std::collections::HashMap;
use super::project_runtime::ProjectRuntime;
use super::types::{OrchestratorError, Result};

pub struct ProjectManager {
    // project manager handles multiple runtime instances
    runtimes: HashMap<String, ProjectRuntime>,
}

impl ProjectManager {
    pub fn new() -> Self {
        Self {
            runtimes: HashMap::new(),
        }
    }

    pub fn register_project(&mut self, project_id: impl Into<String>) -> &ProjectRuntime {
        let project_id = project_id.into();
        self.runtimes
            .entry(project_id.clone())
            .or_insert_with(|| ProjectRuntime::new(project_id))
    }

    pub fn get(&self, project_id: &str) -> Result<&ProjectRuntime> {
        self.runtimes
            .get(project_id)
            .ok_or_else(|| OrchestratorError::NotFound(format!("project {project_id}")))
    }

    pub fn start(&mut self, project_id: &str) -> Result<()> {
        self.get_mut(project_id)?.start();
        Ok(())
    }

    pub fn stop(&mut self, project_id: &str) -> Result<()> {
        self.get_mut(project_id)?.stop();
        Ok(())
    }

    pub fn tick_now(&mut self, project_id: &str) -> Result<()> {
        self.get_mut(project_id)?.tick_now();
        Ok(())
    }

    pub fn start_all(&mut self) -> Result<()> {
        for runtime in self.runtimes.values_mut() {
            runtime.start();
        }
        Ok(())
    }

    pub fn stop_all(&mut self) -> Result<()> {
        for runtime in self.runtimes.values_mut() {
            runtime.stop();
        }
        Ok(())
    }

    fn get_mut(&mut self, project_id: &str) -> Result<&mut ProjectRuntime> {
        self.runtimes
            .get_mut(project_id)
            .ok_or_else(|| OrchestratorError::NotFound(format!("project {project_id}")))
    }
}

impl Default for ProjectManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::RuntimeStatus;

    #[test]
    fn register_is_idempotent_and_preserves_state() {
        let mut manager = ProjectManager::new();

        manager.register_project("p1");
        manager.start("p1").unwrap();

        manager.register_project("p1");
        assert_eq!(manager.get("p1").unwrap().status(), RuntimeStatus::Running);
    }

    #[test]
    fn tracks_multiple_projects_independently() {
        let mut manager = ProjectManager::new();

        manager.register_project("p1");
        manager.register_project("p2");
        manager.start("p1").unwrap();

        assert_eq!(manager.get("p1").unwrap().status(), RuntimeStatus::Running);
        assert_eq!(manager.get("p2").unwrap().status(), RuntimeStatus::Idle);
    }

    #[test]
    fn missing_project_returns_not_found() {
        let mut manager = ProjectManager::new();

        assert!(manager.get("missing").is_err());
        assert!(manager.start("missing").is_err());
        assert!(manager.stop("missing").is_err());
        assert!(manager.tick_now("missing").is_err());
    }

    #[test]
    fn start_all_and_stop_all() {
        let mut manager = ProjectManager::new();

        manager.register_project("p1");
        manager.register_project("p2");
        manager.start_all().unwrap();

        assert_eq!(manager.get("p1").unwrap().status(), RuntimeStatus::Running);
        assert_eq!(manager.get("p2").unwrap().status(), RuntimeStatus::Running);

        manager.stop_all().unwrap();

        assert_eq!(manager.get("p1").unwrap().status(), RuntimeStatus::Stopped);
        assert_eq!(manager.get("p2").unwrap().status(), RuntimeStatus::Stopped);
    }
}

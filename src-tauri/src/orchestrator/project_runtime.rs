use crate::types::RuntimeStatus;

pub struct ProjectRuntime {
    project_id: String,
    status: RuntimeStatus,
}

impl ProjectRuntime {
    pub fn new(project_id: String) -> Self {
        Self {
            project_id,
            status: RuntimeStatus::Idle,
        }
    }

    pub fn project_id(&self) -> &str {
        &self.project_id
    }

    pub fn status(&self) -> RuntimeStatus {
        self.status
    }

    pub fn start(&mut self) {
        self.status = RuntimeStatus::Running;
    }

    pub fn stop(&mut self) {
        self.status = RuntimeStatus::Stopped;
    }

    pub fn tick_now(&mut self) {
    }
}

use serde::{Deserialize, Serialize};

use super::project::PermissionMode;

/// orchestrator mutation payload for control_runtime.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum ControlRuntimeRequest {
    #[serde(rename_all = "camelCase")]
    Start {},
    Stop {},
    Tick {},
    SetPollInterval {
        poll_interval_ms: u32,
    },
    ClearPollIntervalOverride {},
    SetPermissionMode {
        permission_mode: PermissionMode,
    },
    ClearPermissionModeOverride {},
    PauseRun {
        run_attempt_id: String,
    },
    ResumeRun {
        run_attempt_id: String,
    },
    CancelRun {
        run_attempt_id: String,
    },
}

use serde::{Deserialize, Serialize};

use super::agent::Agent;
use super::project::{PermissionMode, PermissionModeSource};
use super::runtime::{PollIntervalSource, RuntimeStatus};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub struct SettingsProjectMeta {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub agents: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    pub status: RuntimeStatus,
    pub workflow_path: Option<String>,
    pub workflow_version: Option<String>,
    pub prompt_template: String,
    pub poll_interval_ms: u32,
    pub poll_interval_source: PollIntervalSource,
    pub permission_mode: PermissionMode,
    pub permission_mode_source: PermissionModeSource,
    pub projects: Vec<SettingsProjectMeta>,
    pub agents: Vec<Agent>,
    pub started_at: Option<String>,
    pub next_tick_at: Option<String>,
    pub tick_count: u32,
    pub last_tick_at: Option<String>,
    pub last_action: Option<String>,
    pub last_error: Option<String>,
}

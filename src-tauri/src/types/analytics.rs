use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use super::SessionEventKind;

/// shared time window for dashboard activity charts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityTimeRange {
    pub start_at: String,
    pub end_at: String,
    pub bucket_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AgentActivityOverTimeBucket {
    pub bucket_start: String,
    pub total_events: u32,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub by_kind: HashMap<SessionEventKind, u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentActivityOverTimeResponse {
    pub buckets: Vec<AgentActivityOverTimeBucket>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PermissionActivityOverTimeBucket {
    pub bucket_start: String,
    pub active_pending: u32,
    pub requests_opened: u32,
    pub requests_resolved: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionActivityOverTimeResponse {
    pub buckets: Vec<PermissionActivityOverTimeBucket>,
}

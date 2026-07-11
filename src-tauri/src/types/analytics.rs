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

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentActivityOverTimeBucket {
    pub bucket_start: String,
    pub total_events: u32,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub by_kind: HashMap<SessionEventKind, u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentActivitySummary {
    pub total_events: u32,
    pub run_attempt_count: u32,
    pub session_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentActivityOverTimeResponse {
    pub buckets: Vec<AgentActivityOverTimeBucket>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<AgentActivitySummary>,
}

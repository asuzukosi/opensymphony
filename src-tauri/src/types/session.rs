use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

/// acp session event kind for issue attempt timelines.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum SessionEventKind {
    Prompt,
    StreamChunk,
    SessionUpdate,
    ToolCall,
    ToolResult,
    PermissionRequest,
    Error,
    Terminal,
}

impl SessionEventKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Prompt => "Prompt",
            Self::StreamChunk => "StreamChunk",
            Self::SessionUpdate => "SessionUpdate",
            Self::ToolCall => "ToolCall",
            Self::ToolResult => "ToolResult",
            Self::PermissionRequest => "PermissionRequest",
            Self::Error => "Error",
            Self::Terminal => "Terminal",
        }
    }
}

impl fmt::Display for SessionEventKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for SessionEventKind {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "Prompt" => Ok(Self::Prompt),
            "StreamChunk" => Ok(Self::StreamChunk),
            "SessionUpdate" => Ok(Self::SessionUpdate),
            "ToolCall" => Ok(Self::ToolCall),
            "ToolResult" => Ok(Self::ToolResult),
            "PermissionRequest" => Ok(Self::PermissionRequest),
            "Error" => Ok(Self::Error),
            "Terminal" => Ok(Self::Terminal),
            _ => Err(()),
        }
    }
}

/// typed payload for common session event kinds; unknown shapes fall back to Other.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SessionEventPayload {
    Prompt { text: String },
    StreamChunk { text: String },
    SessionUpdate { status: String },
    ToolCall { name: String },
    ToolResult { output: String },
    PermissionRequest { summary: String },
    Error { message: String },
    Other(serde_json::Value),
}

/// session event row — shared by repos and ipc.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEvent {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub kind: SessionEventKind,
    pub payload: serde_json::Value,
    pub created_at: String,
}

impl SessionEvent {
    pub fn payload_json(&self) -> String {
        self.payload.to_string()
    }
}

/// agent session row from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSession {
    pub id: String,
    pub run_attempt_id: String,
    pub runtime_kind: String,
    pub session_ref: Option<String>,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
}

/// run attempt row from the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAttempt {
    pub id: String,
    pub issue_id: String,
    pub attempt_number: i32,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error_message: Option<String>,
}

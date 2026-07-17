use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

/// acp session event kind for task attempt timelines.
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
    pub task_id: String,
    pub attempt_number: i32,
    pub status: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error_message: Option<String>,
}

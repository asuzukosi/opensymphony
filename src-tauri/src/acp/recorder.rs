//! accumulate acp session updates; persist consolidated events via callback.

use std::collections::HashMap;

use agent_client_protocol::schema::{
    ContentBlock, ContentChunk, SessionNotification, SessionUpdate, ToolCall, ToolCallId,
    ToolCallStatus, ToolCallUpdate,
};
use serde_json::{json, Value};

use crate::types::SessionEventKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandleUpdateResult {
    pub current_activity: String,
    pub persisted: bool,
}

#[derive(Debug, Default)]
struct TextTrack {
    pending: String,
    completed: Vec<String>,
}

impl TextTrack {
    fn append(&mut self, chunk: &ContentChunk) {
        if let ContentBlock::Text(text) = &chunk.content {
            self.pending.push_str(&text.text);
        }
    }

    fn commit(&mut self, stream_kind: &str, persist: &mut dyn FnMut(SessionEventKind, Value)) {
        let text = self.pending.trim().to_string();
        self.pending.clear();
        if text.is_empty() {
            return;
        }
        self.completed.push(text.clone());
        persist(
            SessionEventKind::StreamChunk,
            json!({
                "update": {
                    "sessionUpdate": stream_kind,
                    "content": { "type": "text", "text": text },
                }
            }),
        );
    }

    fn seal(&mut self) {
        let text = self.pending.trim().to_string();
        self.pending.clear();
        if !text.is_empty() {
            self.completed.push(text);
        }
    }
}

#[derive(Debug, Default)]
pub struct Recorder {
    thoughts: TextTrack,
    messages: TextTrack,
    tools_in_progress: HashMap<ToolCallId, ToolCall>,
    tools_completed: Vec<ToolCall>,
    current_activity: String,
}

impl Recorder {
    pub fn new() -> Self {
        Self::default()
    }

    // pub fn current_activity(&self) -> &str {
    //     &self.current_activity
    // }

    pub fn handle_update(
        &mut self,
        notification: &SessionNotification,
        persist: &mut dyn FnMut(SessionEventKind, Value),
    ) -> HandleUpdateResult {
        let update = &notification.update;

        if !matches!(update, SessionUpdate::UserMessageChunk(_)) {
            self.current_activity = update_kind(update).into();
        }

        match update {
            SessionUpdate::AgentThoughtChunk(chunk) => {
                self.messages.commit("agent_message", persist);
                self.thoughts.append(chunk);
                result(&self.current_activity, false)
            }
            SessionUpdate::AgentMessageChunk(chunk) => {
                self.thoughts.commit("agent_thought", persist);
                self.messages.append(chunk);
                result(&self.current_activity, false)
            }
            SessionUpdate::UserMessageChunk(_) => {
                result(&self.current_activity, false)
            }
            SessionUpdate::ToolCall(tool) => {
                self.flush_streams(persist);
                self.tools_in_progress
                    .insert(tool.tool_call_id.clone(), tool.clone());
                persist(
                    SessionEventKind::ToolCall,
                    serde_json::to_value(notification).unwrap_or(Value::Null),
                );
                result(&self.current_activity, true)
            }
            SessionUpdate::ToolCallUpdate(tool_update) => {
                self.apply_tool_update(tool_update);

                if !tool_update_is_terminal(tool_update) {
                    return result(&self.current_activity, false);
                }

                self.flush_streams(persist);
                let payload = self
                    .finish_tool(&tool_update.tool_call_id)
                    .map(|tool| {
                        json!({
                            "sessionId": notification.session_id,
                            "update": SessionUpdate::ToolCallUpdate(ToolCallUpdate::from(tool)),
                        })
                    })
                    .unwrap_or_else(|| serde_json::to_value(notification).unwrap_or(Value::Null));
                persist(SessionEventKind::SessionUpdate, payload);
                result(&self.current_activity, true)
            }
            _ => {
                self.flush_streams(persist);
                persist(
                    SessionEventKind::SessionUpdate,
                    serde_json::to_value(notification).unwrap_or(Value::Null),
                );
                result(&self.current_activity, true)
            }
        }
    }

    pub fn flush(&mut self, persist: &mut dyn FnMut(SessionEventKind, Value)) {
        self.flush_streams(persist);
    }

    pub fn last_agent_message(&mut self) -> Option<String> {
        self.messages.seal();
        self.messages.completed.last().cloned()
    }

    fn flush_streams(&mut self, persist: &mut dyn FnMut(SessionEventKind, Value)) {
        self.thoughts.commit("agent_thought", persist);
        self.messages.commit("agent_message", persist);
    }

    fn apply_tool_update(&mut self, update: &ToolCallUpdate) {
        let id = update.tool_call_id.clone();
        if let Some(tool) = self.tools_in_progress.get_mut(&id) {
            tool.update(update.fields.clone());
        } else if let Ok(tool) = ToolCall::try_from(update.clone()) {
            self.tools_in_progress.insert(id, tool);
        }
    }

    fn finish_tool(&mut self, id: &ToolCallId) -> Option<ToolCall> {
        self.tools_in_progress.remove(id).map(|tool| {
            self.tools_completed.push(tool.clone());
            tool
        })
    }
}

fn result(activity: &str, persisted: bool) -> HandleUpdateResult {
    HandleUpdateResult {
        current_activity: activity.to_string(),
        persisted,
    }
}

fn update_kind(update: &SessionUpdate) -> &'static str {
    match update {
        SessionUpdate::AgentMessageChunk(_) => "agent_message_chunk",
        SessionUpdate::AgentThoughtChunk(_) => "agent_thought_chunk",
        SessionUpdate::ToolCall(_) => "tool_call",
        SessionUpdate::ToolCallUpdate(_) => "tool_call_update",
        _ => "session_update",
    }
}

fn tool_update_is_terminal(update: &ToolCallUpdate) -> bool {
    update.fields.status.is_some_and(|status| {
        matches!(status, ToolCallStatus::Completed | ToolCallStatus::Failed)
    })
}


import {
  getSessionUpdateKind,
  type SessionUpdate,
} from "@/runtime/acp/acp-protocol";

export interface AgentMessageTracker {
  currentSegment: string;
  lastCompleteMessage: string | null;
}

export function createAgentMessageTracker(): AgentMessageTracker {
  return { currentSegment: "", lastCompleteMessage: null };
}

function extractChunkText(update: SessionUpdate): string {
  const content = (update as { content?: { text?: string } }).content;
  return typeof content?.text === "string" ? content.text : "";
}

export function commitAgentMessageSegment(tracker: AgentMessageTracker): void {
  const text = tracker.currentSegment.trim();
  tracker.currentSegment = "";
  if (!text) {
    return;
  }
  tracker.lastCompleteMessage = text;
}

export function trackAgentMessageFromUpdate(
  tracker: AgentMessageTracker,
  update: SessionUpdate,
): void {
  const updateKind = getSessionUpdateKind(update);

  if (updateKind === "agent_message_chunk") {
    tracker.currentSegment += extractChunkText(update);
    return;
  }

  if (updateKind === "agent_thought_chunk" || updateKind === "user_message_chunk") {
    return;
  }

  commitAgentMessageSegment(tracker);
}

export function resolveLastAgentMessage(tracker: AgentMessageTracker): string | null {
  commitAgentMessageSegment(tracker);
  return tracker.lastCompleteMessage;
}

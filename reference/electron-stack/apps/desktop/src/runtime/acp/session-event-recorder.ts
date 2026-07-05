import type { SessionEventKind } from "@symphony/db";
import {
  getSessionUpdateKind,
  type SessionNotification,
  type SessionUpdate,
} from "@/runtime/acp/acp-protocol";

export interface StreamBuffers {
  thoughtText: string;
  messageText: string;
}

export function createStreamBuffers(): StreamBuffers {
  return { thoughtText: "", messageText: "" };
}

export type PersistSessionEvent = (kind: SessionEventKind, payload: unknown) => void;

export interface HandleSessionUpdateInput {
  params: SessionNotification;
  buffers: StreamBuffers;
  persist: PersistSessionEvent;
}

export interface HandleSessionUpdateResult {
  lastEventSummary: string;
  persisted: boolean;
}

const CHUNK_UPDATE_KINDS = new Set([
  "agent_thought_chunk",
  "agent_message_chunk",
  "user_message_chunk",
]);

function extractChunkText(update: SessionUpdate): string {
  const content = (update as { content?: { text?: string } }).content;
  return typeof content?.text === "string" ? content.text : "";
}

function flushThought(buffers: StreamBuffers, persist: PersistSessionEvent): void {
  const text = buffers.thoughtText.trim();
  buffers.thoughtText = "";
  if (!text) {
    return;
  }

  persist("stream_chunk", {
    update: {
      sessionUpdate: "agent_thought",
      content: { type: "text", text },
    },
  });
}

function flushMessage(buffers: StreamBuffers, persist: PersistSessionEvent): void {
  const text = buffers.messageText.trim();
  buffers.messageText = "";
  if (!text) {
    return;
  }

  persist("stream_chunk", {
    update: {
      sessionUpdate: "agent_message",
      content: { type: "text", text },
    },
  });
}

export function flushStreamBuffers(
  buffers: StreamBuffers,
  persist: PersistSessionEvent,
): void {
  flushThought(buffers, persist);
  flushMessage(buffers, persist);
}

function isTerminalToolCallUpdate(update: SessionUpdate): boolean {
  if (update.sessionUpdate !== "tool_call_update") {
    return false;
  }

  const status = (update as { status?: string | null }).status;
  return status === "completed" || status === "failed";
}

export function shouldPersistSessionUpdate(update: SessionUpdate): boolean {
  const updateKind = getSessionUpdateKind(update);

  if (CHUNK_UPDATE_KINDS.has(updateKind)) {
    return false;
  }

  if (updateKind === "tool_call_update") {
    return isTerminalToolCallUpdate(update);
  }

  return true;
}

export function handleSessionUpdateForPersistence(
  input: HandleSessionUpdateInput,
): HandleSessionUpdateResult {
  const update = input.params.update;
  const updateKind = getSessionUpdateKind(update);

  if (updateKind === "agent_thought_chunk") {
    input.buffers.thoughtText += extractChunkText(update);
    return { lastEventSummary: "agent_thought", persisted: false };
  }

  if (updateKind === "agent_message_chunk") {
    flushThought(input.buffers, input.persist);
    input.buffers.messageText += extractChunkText(update);
    return { lastEventSummary: "agent_message", persisted: false };
  }

  if (updateKind === "user_message_chunk") {
    return { lastEventSummary: updateKind, persisted: false };
  }

  if (updateKind === "tool_call") {
    flushStreamBuffers(input.buffers, input.persist);
    input.persist("tool_call", input.params);
    return { lastEventSummary: updateKind, persisted: true };
  }

  if (updateKind === "tool_call_update") {
    if (!isTerminalToolCallUpdate(update)) {
      return { lastEventSummary: updateKind, persisted: false };
    }

    flushStreamBuffers(input.buffers, input.persist);
    input.persist("session_update", input.params);
    return { lastEventSummary: updateKind, persisted: true };
  }

  flushStreamBuffers(input.buffers, input.persist);
  input.persist("session_update", input.params);
  return { lastEventSummary: updateKind, persisted: true };
}

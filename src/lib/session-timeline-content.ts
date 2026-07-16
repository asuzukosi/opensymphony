import {
  extractToolCallUpdate,
  formatToolCallMarkdown,
  formatToolCallPayload,
  type FormattedToolCall,
} from "@/lib/format-tool-call";
import type { SessionEvent } from "@/lib/ipc/types";
import { summarizeText } from "@/lib/utils";

const PREVIEW_MAX_LENGTH = 240;

export type TimelinePreview = {
  text: string;
  detail: string | null;
  tool: FormattedToolCall | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function truncateText(text: string, maxLength = PREVIEW_MAX_LENGTH): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function fullPayloadText(payload: unknown): string | null {
  if (typeof payload === "string") {
    const text = payload.trim();
    return text.length > 0 ? text : null;
  }

  const record = asRecord(payload);
  if (record == null) {
    return null;
  }

  for (const key of ["text", "message", "body"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function extractAgentMessageText(payload: unknown): string | null {
  const record = asRecord(payload);
  const update = asRecord(record?.update);
  if (update == null || update.sessionUpdate !== "agent_message") {
    return null;
  }

  const content = asRecord(update.content);
  const text = typeof content?.text === "string" ? content.text.trim() : "";
  return text.length > 0 ? text : null;
}

function extractPromptText(payload: unknown): string | null {
  return fullPayloadText(payload);
}

function extractSessionUpdateText(payload: unknown): string | null {
  const record = asRecord(payload);
  const update = asRecord(record?.update);
  if (update == null) {
    return null;
  }

  const content = asRecord(update.content);
  const text = typeof content?.text === "string" ? content.text.trim() : "";
  return text.length > 0 ? text : null;
}

export function getTimelinePreview(event: SessionEvent): TimelinePreview | null {
  const tool = formatToolCallPayload(event.payload);
  if (tool != null) {
    return {
      text: tool.summary,
      detail: tool.detail != null ? summarizeText(tool.detail, 120) : null,
      tool,
    };
  }

  const agentMessage = extractAgentMessageText(event.payload);
  if (agentMessage != null) {
    return { text: truncateText(agentMessage), detail: null, tool: null };
  }

  const prompt = event.kind === "Prompt" ? extractPromptText(event.payload) : null;
  if (prompt != null) {
    return { text: truncateText(prompt), detail: null, tool: null };
  }

  const sessionText = event.kind === "SessionUpdate" ? extractSessionUpdateText(event.payload) : null;
  if (sessionText != null) {
    return { text: truncateText(sessionText), detail: null, tool: null };
  }

  const fallback = fullPayloadText(event.payload);
  if (fallback != null) {
    return { text: truncateText(fallback), detail: null, tool: null };
  }

  const labels: Partial<Record<SessionEvent["kind"], string>> = {
    Prompt: "Prompt sent to agent",
    ToolCall: "Tool call",
    ToolResult: "Tool result",
    PermissionRequest: "Permission requested",
    Error: "Session error",
    SessionUpdate: "Session update",
    Terminal: "Terminal event",
    StreamChunk: "Stream chunk",
  };

  const label = labels[event.kind];
  return label != null ? { text: label, detail: null, tool: null } : null;
}

export function getTimelineMarkdown(event: SessionEvent): string | null {
  const tool = formatToolCallPayload(event.payload);
  if (tool != null) {
    const update = extractToolCallUpdate(event.payload);
    if (update != null) {
      return formatToolCallMarkdown(update, tool);
    }
  }

  const agentMessage = extractAgentMessageText(event.payload);
  if (agentMessage != null) {
    return agentMessage;
  }

  if (event.kind === "Prompt") {
    return extractPromptText(event.payload);
  }

  if (event.kind === "SessionUpdate") {
    const sessionText = extractSessionUpdateText(event.payload);
    if (sessionText != null) {
      return sessionText;
    }
  }

  const fallback = fullPayloadText(event.payload);
  if (fallback != null) {
    return fallback;
  }

  if (event.kind === "PermissionRequest") {
    try {
      return ["```json", JSON.stringify(event.payload, null, 2), "```"].join("\n");
    } catch {
      return null;
    }
  }

  return getTimelinePreview(event)?.text ?? null;
}

export function isTimelineExpandable(event: SessionEvent): boolean {
  return getTimelineMarkdown(event) != null;
}

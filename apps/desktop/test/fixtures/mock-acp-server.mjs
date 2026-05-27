#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import readline from "node:readline";

const PROTOCOL_VERSION = 1;

/** @type {Map<string, { cancelled: boolean }>} */
const sessions = new Map();

/** @type {{ sessionId: string, requestId: number | string, cancelled: boolean } | null} */
let activePrompt = null;

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function writeResponse(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function writeError(id, code, message) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}

function notifySessionUpdate(sessionId, update) {
  writeMessage({
    jsonrpc: "2.0",
    method: "session/update",
    params: { sessionId, update },
  });
}

function promptText(params) {
  return (params.prompt ?? [])
    .filter((block) => block?.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

async function handlePrompt(id, params) {
  const session = sessions.get(params.sessionId);
  if (!session) {
    writeError(id, -32602, `unknown session ${params.sessionId}`);
    return;
  }

  activePrompt = {
    sessionId: params.sessionId,
    requestId: id,
    cancelled: false,
  };

  const taskPreview = promptText(params);
  const intro = taskPreview.length > 0 ? `received task (${taskPreview.length} chars)` : "received task";

  notifySessionUpdate(params.sessionId, {
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: `mock acp agent: ${intro}.` },
  });

  if (activePrompt.cancelled) {
    writeResponse(id, { stopReason: "cancelled" });
    activePrompt = null;
    return;
  }

  notifySessionUpdate(params.sessionId, {
    sessionUpdate: "tool_call",
    toolCallId: "mock_call_1",
    title: "mock tool run",
    kind: "execute",
    status: "completed",
  });

  notifySessionUpdate(params.sessionId, {
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: " mock acp agent: done." },
  });

  writeResponse(id, {
    stopReason: activePrompt.cancelled ? "cancelled" : "end_turn",
  });
  activePrompt = null;
}

function handleRequest(message) {
  const { id, method, params = {} } = message;

  switch (method) {
    case "initialize":
      writeResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        agentCapabilities: {},
      });
      return;
    case "session/new": {
      const sessionId = randomUUID();
      sessions.set(sessionId, { cancelled: false });
      writeResponse(id, { sessionId });
      return;
    }
    case "session/prompt":
      void handlePrompt(id, params);
      return;
    default:
      writeError(id, -32601, `method not found: ${method}`);
  }
}

function handleNotification(message) {
  const { method, params = {} } = message;

  if (method !== "session/cancel") {
    return;
  }

  const session = sessions.get(params.sessionId);
  if (session) {
    session.cancelled = true;
  }

  if (activePrompt && activePrompt.sessionId === params.sessionId) {
    activePrompt.cancelled = true;
  }
}

function handleLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    if (process.env.SYMPHONY_MOCK_ACP_DEBUG === "1") {
      process.stderr.write(`mock-acp-server: invalid json: ${trimmed}\n`);
    }
    return;
  }

  if (typeof message.method !== "string") {
    return;
  }

  if (Object.hasOwn(message, "id")) {
    handleRequest(message);
    return;
  }

  handleNotification(message);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", handleLine);

process.stdin.on("end", () => {
  rl.close();
  process.exit(0);
});

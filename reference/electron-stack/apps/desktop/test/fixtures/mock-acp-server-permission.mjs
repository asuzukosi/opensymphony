#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import readline from "node:readline";

const PROTOCOL_VERSION = 1;

/** @type {Map<string, { cancelled: boolean }>} */
const sessions = new Map();

/** @type {Map<string | number, { promptId: string | number, sessionId: string }>} */
const pendingPermissionResponses = new Map();

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

function requestPermissionFromClient(sessionId, permissionRequestId) {
  writeMessage({
    jsonrpc: "2.0",
    id: permissionRequestId,
    method: "session/request_permission",
    params: {
      sessionId,
      options: [
        { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
        { optionId: "reject-once", name: "Reject", kind: "reject_once" },
      ],
      toolCall: {
        toolCallId: "tool-perm-1",
        title: "Run tests",
        kind: "execute",
        status: "pending",
      },
    },
  });
}

function finishPrompt(promptId, _sessionId) {
  writeResponse(promptId, { stopReason: "end_turn" });
}

async function handlePrompt(id, params) {
  const session = sessions.get(params.sessionId);
  if (!session) {
    writeError(id, -32602, `unknown session ${params.sessionId}`);
    return;
  }

  const permissionRequestId = randomUUID();
  pendingPermissionResponses.set(permissionRequestId, {
    promptId: id,
    sessionId: params.sessionId,
  });
  requestPermissionFromClient(params.sessionId, permissionRequestId);
}

function handleClientResponse(message) {
  const pending = pendingPermissionResponses.get(message.id);
  if (!pending) {
    return;
  }

  pendingPermissionResponses.delete(message.id);

  if (message.error) {
    writeError(pending.promptId, message.error.code ?? -32603, message.error.message ?? "permission failed");
    return;
  }

  finishPrompt(pending.promptId, pending.sessionId);
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

function handleLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (Object.hasOwn(message, "method")) {
    if (Object.hasOwn(message, "id")) {
      handleRequest(message);
    }
    return;
  }

  if (Object.hasOwn(message, "id")) {
    handleClientResponse(message);
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", handleLine);

process.stdin.on("end", () => {
  rl.close();
  process.exit(0);
});

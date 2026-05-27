#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

const PROTOCOL_VERSION = 1;
const DEFAULT_ARTIFACT_NAME = ".symphony-demo-artifact.txt";

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

function debugLog(message) {
  if (process.env.SYMPHONY_DEMO_ACP_DEBUG === "1") {
    process.stderr.write(`demo-acp-server: ${message}\n`);
  }
}

function delayMs() {
  const raw = process.env.SYMPHONY_DEMO_ACP_DELAY_MS;
  if (raw == null || raw.trim() === "") {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function sleep(ms) {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function workspacePath() {
  const configured = process.env.SYMPHONY_WORKSPACE_PATH?.trim();
  return configured && configured.length > 0 ? configured : process.cwd();
}

function artifactFileName() {
  const configured = process.env.SYMPHONY_DEMO_ACP_ARTIFACT?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_ARTIFACT_NAME;
}

function shouldFail(taskPreview) {
  const failFlag = process.env.SYMPHONY_DEMO_ACP_FAIL?.trim().toLowerCase();
  if (failFlag === "1" || failFlag === "true" || failFlag === "yes") {
    return true;
  }

  const issueId = process.env.SYMPHONY_ISSUE_ID ?? "";
  return issueId.toLowerCase().includes("fail");
}

function writeDemoArtifact(sessionId, taskPreview) {
  const artifactPath = path.join(workspacePath(), artifactFileName());
  const contents = [
    "symphony demo acp artifact",
    `session_id=${sessionId}`,
    `issue_id=${process.env.SYMPHONY_ISSUE_ID ?? "unknown"}`,
    `run_attempt_id=${process.env.SYMPHONY_RUN_ATTEMPT_ID ?? "unknown"}`,
    "",
    taskPreview,
    "",
  ].join("\n");
  writeFileSync(artifactPath, contents, "utf8");
  debugLog(`wrote artifact ${artifactPath}`);
  return artifactPath;
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
  const intro =
    taskPreview.length > 0 ? `received task (${taskPreview.length} chars)` : "received task";
  const stepDelayMs = delayMs();

  await sleep(stepDelayMs);
  notifySessionUpdate(params.sessionId, {
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: `demo acp agent: ${intro}.` },
  });

  if (activePrompt.cancelled) {
    writeResponse(id, { stopReason: "cancelled" });
    activePrompt = null;
    return;
  }

  if (shouldFail(taskPreview)) {
    await sleep(stepDelayMs);
    notifySessionUpdate(params.sessionId, {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: " demo acp agent: failing by request." },
    });
    writeResponse(id, { stopReason: "refusal" });
    activePrompt = null;
    return;
  }

  await sleep(stepDelayMs);
  const artifactPath = writeDemoArtifact(params.sessionId, taskPreview);
  notifySessionUpdate(params.sessionId, {
    sessionUpdate: "tool_call",
    toolCallId: "demo_call_1",
    title: "write demo artifact",
    kind: "execute",
    status: "completed",
    summary: artifactPath,
  });

  await sleep(stepDelayMs);
  notifySessionUpdate(params.sessionId, {
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: " demo acp agent: done." },
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
    debugLog(`invalid json: ${trimmed}`);
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

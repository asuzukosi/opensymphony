import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  defaultInitializeRequest,
  getSessionUpdateKind,
  PROTOCOL_VERSION,
  type SessionUpdate,
} from "@/runtime/acp/acp-protocol";
import { renderPromptTemplate } from "@/runtime/acp/prompt-renderer";
import { bridgeStdioToACPStream, createACPStdioStream } from "@/runtime/acp/stdio-stream";
import { createSymphonyACPConnection } from "@/runtime/acp/symphony-client";

const mockServerPath = fileURLToPath(
  new URL("./fixtures/mock-acp-server.mjs", import.meta.url),
);

const workflowPromptTemplate = [
  "You are working on a Symphony issue from the local project board.",
  "",
  "Issue: {{identifier}}",
  "Title: {{title}}",
  "{{description}}",
].join("\n");

const issue = {
  identifier: "sym-7",
  title: "Wire ACP client",
  description: "Integrate session/prompt with the orchestrator.",
};

function spawnMockAcpServer(): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, [mockServerPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });
}

async function readStreamMessage<T>(readable: ReadableStream<T>): Promise<T> {
  const reader = readable.getReader();
  try {
    const { value, done } = await reader.read();
    if (done || value === undefined) {
      throw new Error("expected readable stream message");
    }
    return value;
  } finally {
    reader.releaseLock();
  }
}

function agentMessageChunkText(update: SessionUpdate): string | null {
  if (update.sessionUpdate !== "agent_message_chunk") {
    return null;
  }

  const { content } = update;
  return content.type === "text" ? content.text : null;
}

describe("acp json-rpc wire layer", () => {
  describe("stdio transport", () => {
    test("round-trips initialize over mock agent stdio", async () => {
      const child = spawnMockAcpServer();
      const stdio = createACPStdioStream(child);

      const writer = stdio.stream.writable.getWriter();
      await writer.write({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: defaultInitializeRequest(),
      });
      writer.releaseLock();

      const message = await readStreamMessage(stdio.stream.readable);
      expect(message).toMatchObject({
        jsonrpc: "2.0",
        id: 1,
        result: { protocolVersion: PROTOCOL_VERSION },
      });

      stdio.close();
      await once(child, "exit");
    });

    test("rejects unpiped stdio", () => {
      expect(() =>
        bridgeStdioToACPStream({
          stdin: null as unknown as NodeJS.WritableStream,
          stdout: null as unknown as NodeJS.ReadableStream,
        }),
      ).toThrow("acp stdio bridge requires piped stdin and stdout");
    });
  });

  describe("symphony client rpc", () => {
    test("negotiates initialize with symphony defaults", async () => {
      const child = spawnMockAcpServer();
      const stdio = createACPStdioStream(child);
      const { connection } = createSymphonyACPConnection(stdio.stream);

      const response = await connection.initialize(defaultInitializeRequest());

      expect(response.protocolVersion).toBe(PROTOCOL_VERSION);
      stdio.close();
      await once(child, "exit");
    });

    test("completes session/new and session/prompt with session/update stream", async () => {
      const child = spawnMockAcpServer();
      const stdio = createACPStdioStream(child);
      const updateKinds: string[] = [];
      const messageChunks: string[] = [];

      const { connection } = createSymphonyACPConnection(stdio.stream, {
        sessionUpdate: async (params) => {
          updateKinds.push(getSessionUpdateKind(params.update));
          const text = agentMessageChunkText(params.update);
          if (text !== null) {
            messageChunks.push(text);
          }
        },
      });

      await connection.initialize(defaultInitializeRequest());
      const session = await connection.newSession({
        cwd: process.cwd(),
        mcpServers: [],
      });

      const promptText = "ship the acp adapter";
      const promptResult = await connection.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: promptText }],
      });

      expect(promptResult.stopReason).toBe("end_turn");
      expect(updateKinds).toEqual(["agent_message_chunk", "tool_call", "agent_message_chunk"]);
      expect(messageChunks[0]).toContain(`received task (${promptText.length} chars)`);

      stdio.close();
      await once(child, "exit");
    });
  });

  describe("prompt renderer", () => {
    test("sends rendered workflow prompt through session/prompt", async () => {
      const renderedPrompt = renderPromptTemplate({
        promptTemplate: workflowPromptTemplate,
        issue,
      });

      const child = spawnMockAcpServer();
      const stdio = createACPStdioStream(child);
      let firstChunk = "";

      const { connection } = createSymphonyACPConnection(stdio.stream, {
        sessionUpdate: async (params) => {
          if (firstChunk.length > 0) {
            return;
          }

          const text = agentMessageChunkText(params.update);
          if (text !== null) {
            firstChunk = text;
          }
        },
      });

      await connection.initialize(defaultInitializeRequest());
      const session = await connection.newSession({
        cwd: process.cwd(),
        mcpServers: [],
      });

      const promptResult = await connection.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: renderedPrompt }],
      });

      expect(promptResult.stopReason).toBe("end_turn");
      expect(firstChunk).toContain(`received task (${renderedPrompt.length} chars)`);
      expect(renderedPrompt).toContain("Issue: sym-7");
      expect(renderedPrompt).toContain("Title: Wire ACP client");

      stdio.close();
      await once(child, "exit");
    });

    test("fails fast on unknown template variables", () => {
      expect(() =>
        renderPromptTemplate({
          promptTemplate: "Issue {{identifier}} priority {{priority}}",
          issue,
        }),
      ).toThrow("prompt template: unknown variable {{priority}}");
    });
  });
});

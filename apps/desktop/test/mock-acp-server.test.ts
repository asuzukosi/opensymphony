import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { getSessionUpdateKind } from "@/runtime/acp/acp-protocol";
import { createACPStdioStream } from "@/runtime/acp/stdio-stream";
import { createSymphonyACPConnection } from "@/runtime/acp/symphony-client";

const mockServerPath = fileURLToPath(
  new URL("./fixtures/mock-acp-server.mjs", import.meta.url),
);

function spawnMockACPServer(): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, [mockServerPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });
}

describe("mock-acp-server", () => {
  test("runs initialize → session/new → session/prompt lifecycle", async () => {
    const child = spawnMockACPServer();
    const stdio = createACPStdioStream(child);
    const updates: string[] = [];

    const { connection } = createSymphonyACPConnection(stdio.stream, {
      sessionUpdate: async (params) => {
        updates.push(getSessionUpdateKind(params.update));
      },
    });

    await connection.initialize({
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: "symphony-test", version: "0.0.0" },
    });

    const session = await connection.newSession({
      cwd: process.cwd(),
      mcpServers: [],
    });

    const promptResult = await connection.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "implement feature x" }],
    });

    expect(promptResult.stopReason).toBe("end_turn");
    expect(updates).toEqual(["agent_message_chunk", "tool_call", "agent_message_chunk"]);

    stdio.close();
    await once(child, "exit");
  });
});

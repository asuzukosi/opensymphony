import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { describe, expect, test } from "vitest";
import { defaultInitializeRequest } from "@/runtime/acp/acp-protocol";
import { createACPStdioStream } from "@/runtime/acp/stdio-stream";
import {
  createSymphonyACPConnection,
  SymphonyACPClient,
} from "@/runtime/acp/symphony-client";

const INITIALIZE_SERVER = `
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  const message = JSON.parse(trimmed);
  if (message.method !== "initialize") return;
  process.stdout.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? 1,
        agentCapabilities: {},
      },
    }) + "\\n",
  );
  process.exit(0);
});
`;

function spawnInitializeServer(): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, ["-e", INITIALIZE_SERVER], {
    stdio: ["pipe", "pipe", "pipe"],
  });
}

describe("symphony-client", () => {
  test("creates ClientSideConnection and completes initialize", async () => {
    const child = spawnInitializeServer();
    const stdio = createACPStdioStream(child);
    const { connection } = createSymphonyACPConnection(stdio.stream);

    const response = await connection.initialize(defaultInitializeRequest());

    expect(response.protocolVersion).toBeDefined();
    stdio.close();
    await once(child, "exit");
  });

  test("auto approves when requestPermission has no handler", async () => {
    const client = new SymphonyACPClient();

    await expect(
      client.requestPermission({
        sessionId: "session-1",
        options: [
          { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
        ],
        toolCall: {
          toolCallId: "tool-1",
          title: "run command",
          kind: "execute",
          status: "pending",
        },
      }),
    ).resolves.toEqual({
      outcome: { outcome: "selected", optionId: "allow-once" },
    });
  });

  test("delegates sessionUpdate to configured handler", async () => {
    const updates: unknown[] = [];
    const client = new SymphonyACPClient({
      sessionUpdate: async (params) => {
        updates.push(params);
      },
    });

    const notification = {
      sessionId: "session-1",
      update: {
        sessionUpdate: "agent_message_chunk" as const,
        content: { type: "text" as const, text: "hello" },
      },
    };

    await client.sessionUpdate(notification);

    expect(updates).toEqual([notification]);
  });
});

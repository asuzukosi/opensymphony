import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { describe, expect, test } from "vitest";
import { bridgeStdioToACPStream, createACPStdioStream } from "@/runtime/acp/stdio-stream";

const ECHO_SERVER = `
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  const message = JSON.parse(trimmed);
  if (message.method === "initialize") {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        result: { protocolVersion: message.params?.protocolVersion ?? 1 },
      }) + "\\n",
    );
  }
});
process.stdin.on("end", () => process.exit(0));
`;

async function collectReadableMessages(
  readable: ReadableStream<unknown>,
  maxMessages = 1,
): Promise<unknown[]> {
  const messages: unknown[] = [];
  const reader = readable.getReader();

  try {
    while (messages.length < maxMessages) {
      const { value, done } = await reader.read();
      if (done) break;
      messages.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return messages;
}

function spawnEchoServer(): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, ["-e", ECHO_SERVER], {
    stdio: ["pipe", "pipe", "pipe"],
  });
}

describe("stdio-stream", () => {
  test("bridges child stdio to ndjson stream for round-trip rpc", async () => {
    const child = spawnEchoServer();
    const handle = createACPStdioStream(child);

    const writer = handle.stream.writable.getWriter();
    await writer.write({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: 1 },
    });
    writer.releaseLock();

    const messages = await collectReadableMessages(handle.stream.readable);
    expect(messages).toEqual([
      {
        jsonrpc: "2.0",
        id: 1,
        result: { protocolVersion: 1 },
      },
    ]);

    handle.close();
    await once(child, "exit");
  });

  test("accepts generic piped stdio streams", async () => {
    const child = spawnEchoServer();
    const handle = bridgeStdioToACPStream(child);

    const writer = handle.stream.writable.getWriter();
    await writer.write({
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: { protocolVersion: 3 },
    });
    writer.releaseLock();

    const messages = await collectReadableMessages(handle.stream.readable);
    expect(messages[0]).toMatchObject({
      id: 2,
      result: { protocolVersion: 3 },
    });

    handle.close();
    await once(child, "exit");
  });

  test("rejects stdio that is not piped", () => {
    expect(() =>
      bridgeStdioToACPStream({
        stdin: null as unknown as NodeJS.WritableStream,
        stdout: null as unknown as NodeJS.ReadableStream,
      }),
    ).toThrow("acp stdio bridge requires piped stdin and stdout");
  });
});

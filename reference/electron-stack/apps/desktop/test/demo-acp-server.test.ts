import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { getSessionUpdateKind } from "@/runtime/acp/acp-protocol";
import { createACPStdioStream } from "@/runtime/acp/stdio-stream";
import { createSymphonyACPConnection } from "@/runtime/acp/symphony-client";

const demoServerPath = fileURLToPath(
  new URL("../../../scripts/demo-acp-server.mjs", import.meta.url),
);

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeWorkspacePath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-demo-acp-workspace-"));
  tempDirs.push(dir);
  return dir;
}

function spawnDemoACPServer(
  env: Record<string, string | undefined> = {},
): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, [demoServerPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      ...env,
    },
  });
}

describe("demo-acp-server", () => {
  test("runs initialize → session/new → session/prompt lifecycle", async () => {
    const child = spawnDemoACPServer();
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

  test("writes a demo artifact into the issue workspace", async () => {
    const workspace = makeWorkspacePath();
    const child = spawnDemoACPServer({
      SYMPHONY_WORKSPACE_PATH: workspace,
      SYMPHONY_ISSUE_ID: "issue-demo-artifact",
      SYMPHONY_RUN_ATTEMPT_ID: "run-demo-artifact",
      SYMPHONY_DEMO_ACP_ARTIFACT: "demo-output.txt",
    });
    const stdio = createACPStdioStream(child);

    const { connection } = createSymphonyACPConnection(stdio.stream, {
      sessionUpdate: async () => undefined,
    });

    await connection.initialize({
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: "symphony-test", version: "0.0.0" },
    });

    const session = await connection.newSession({
      cwd: workspace,
      mcpServers: [],
    });

    const promptResult = await connection.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "write demo artifact" }],
    });

    expect(promptResult.stopReason).toBe("end_turn");

    const artifactPath = path.join(workspace, "demo-output.txt");
    const artifact = readFileSync(artifactPath, "utf8");
    expect(artifact).toContain("symphony demo acp artifact");
    expect(artifact).toContain("issue_id=issue-demo-artifact");
    expect(artifact).toContain("write demo artifact");

    stdio.close();
    await once(child, "exit");
  });

  test("supports configured failure mode", async () => {
    const child = spawnDemoACPServer({
      SYMPHONY_DEMO_ACP_FAIL: "1",
    });
    const stdio = createACPStdioStream(child);

    const { connection } = createSymphonyACPConnection(stdio.stream, {
      sessionUpdate: async () => undefined,
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
      prompt: [{ type: "text", text: "this should fail" }],
    });

    expect(promptResult.stopReason).toBe("refusal");

    stdio.close();
    await once(child, "exit");
  });

  test("honors configurable delay between session updates", async () => {
    const child = spawnDemoACPServer({
      SYMPHONY_DEMO_ACP_DELAY_MS: "40",
    });
    const stdio = createACPStdioStream(child);
    const updateTimes: number[] = [];

    const { connection } = createSymphonyACPConnection(stdio.stream, {
      sessionUpdate: async () => {
        updateTimes.push(Date.now());
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

    const startedAt = Date.now();
    const promptResult = await connection.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "delayed run" }],
    });
    const elapsedMs = Date.now() - startedAt;

    expect(promptResult.stopReason).toBe("end_turn");
    expect(updateTimes.length).toBe(3);
    expect(elapsedMs).toBeGreaterThanOrEqual(80);

    stdio.close();
    await once(child, "exit");
  });
});

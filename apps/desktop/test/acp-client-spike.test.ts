import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  defaultInitializeRequest,
  getSessionUpdateKind,
  PROTOCOL_VERSION,
} from "@/runtime/acp/acp-protocol";
import { createACPStdioStream } from "@/runtime/acp/stdio-stream";
import { createSymphonyACPConnection } from "@/runtime/acp/symphony-client";

interface HermesACPLaunch {
  readonly command: string;
  readonly args: readonly string[];
}

function resolveHermesACPLaunch(): HermesACPLaunch | null {
  if (process.env.SYMPHONY_SKIP_HERMES_SPIKE === "1") {
    return null;
  }

  const command = process.env.HERMES_ACP_COMMAND?.trim() || "hermes";
  const probes: Array<{ args: string[]; label: string }> = [
    { args: ["acp", "--version"], label: "acp --version" },
    { args: ["acp", "--check"], label: "acp --check" },
  ];

  for (const probe of probes) {
    const result = spawnSync(command, probe.args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (result.status === 0) {
      return { command, args: ["acp"] };
    }
  }

  return null;
}

const hermesACP = resolveHermesACPLaunch();

function spawnHermesACP(workspacePath: string): ChildProcessWithoutNullStreams {
  if (!hermesACP) {
    throw new Error("hermes acp launch config missing");
  }

  return spawn(hermesACP.command, [...hermesACP.args], {
    cwd: workspacePath,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

describe.skipIf(hermesACP === null)("ACP client hermes spike", () => {
  const tempDirs: string[] = [];
  const children: ChildProcessWithoutNullStreams[] = [];

  afterEach(async () => {
    while (children.length > 0) {
      const child = children.pop();
      if (!child || child.killed) {
        continue;
      }

      child.kill("SIGTERM");
      await once(child, "exit").catch(() => undefined);
    }

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  test("initializes against local hermes acp", async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), "symphony-hermes-spike-"));
    tempDirs.push(workspace);

    const child = spawnHermesACP(workspace);
    children.push(child);

    const stdio = createACPStdioStream(child);
    const { connection } = createSymphonyACPConnection(stdio.stream);

    const response = await connection.initialize(defaultInitializeRequest());

    expect(response.protocolVersion).toBe(PROTOCOL_VERSION);
    stdio.close();
  });

  test("creates a session on local hermes acp", async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), "symphony-hermes-spike-"));
    tempDirs.push(workspace);

    const child = spawnHermesACP(workspace);
    children.push(child);

    const stdio = createACPStdioStream(child);
    const { connection } = createSymphonyACPConnection(stdio.stream);

    await connection.initialize(defaultInitializeRequest());
    const session = await connection.newSession({
      cwd: workspace,
      mcpServers: [],
    });

    expect(session.sessionId.length).toBeGreaterThan(0);
    stdio.close();
  });

  test(
    "runs session/prompt against local hermes acp",
    async () => {
      const workspace = mkdtempSync(path.join(tmpdir(), "symphony-hermes-spike-"));
      tempDirs.push(workspace);

      const child = spawnHermesACP(workspace);
      children.push(child);

      const stdio = createACPStdioStream(child);
      const updateKinds: string[] = [];

      const { connection } = createSymphonyACPConnection(stdio.stream, {
        sessionUpdate: async (params) => {
          updateKinds.push(getSessionUpdateKind(params.update));
        },
      });

      await connection.initialize(defaultInitializeRequest());
      const session = await connection.newSession({
        cwd: workspace,
        mcpServers: [],
      });

      const promptResult = await connection.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "Reply with the single word ok." }],
      });

      expect(promptResult.stopReason).toBeDefined();
      expect(updateKinds.length).toBeGreaterThan(0);
      stdio.close();
    },
    180_000,
  );
});

describe("ACP client hermes spike availability", () => {
  test("documents skip behavior when hermes acp is unavailable", () => {
    if (hermesACP !== null) {
      expect(hermesACP.command.length).toBeGreaterThan(0);
      expect(hermesACP.args).toEqual(["acp"]);
      return;
    }

    expect(resolveHermesACPLaunch()).toBeNull();
  });
});

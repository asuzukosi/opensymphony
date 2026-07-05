import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { defaultInitializeRequest } from "@/runtime/acp/acp-protocol";
import {
  createPermissionRouter,
  type PermissionMode,
} from "@/runtime/acp/permission-router";
import { createPermissionStore } from "@/runtime/acp/permission-store";
import { createACPStdioStream } from "@/runtime/acp/stdio-stream";
import { createSymphonyACPConnection } from "@/runtime/acp/symphony-client";

const permissionMockServerPath = fileURLToPath(
  new URL("./fixtures/mock-acp-server-permission.mjs", import.meta.url),
);

function spawnPermissionMockServer(): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, [permissionMockServerPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function createPermissionTestHarness(initialMode: PermissionMode) {
  const store = createPermissionStore();
  let mode = initialMode;
  const router = createPermissionRouter({
    store,
    getPermissionMode: () => mode,
  });

  return {
    store,
    router,
    setMode(nextMode: PermissionMode) {
      mode = nextMode;
    },
    createConnection() {
      const child = spawnPermissionMockServer();
      const stdio = createACPStdioStream(child);
      const { connection } = createSymphonyACPConnection(stdio.stream, {
        requestPermission: router.createRequestPermissionHandler("issue-1"),
      });

      return { child, stdio, connection };
    },
  };
}

async function runPromptWithPermissionRequest(
  harness: ReturnType<typeof createPermissionTestHarness>,
) {
  const { child, stdio, connection } = harness.createConnection();

  await connection.initialize(defaultInitializeRequest());
  const session = await connection.newSession({
    cwd: process.cwd(),
    mcpServers: [],
  });

  const promptPromise = connection.prompt({
    sessionId: session.sessionId,
    prompt: [{ type: "text", text: "run tests" }],
  });

  return { child, stdio, promptPromise };
}

describe("ACP permission integration", () => {
  test("auto_approve completes session/prompt without enqueueing permissions", async () => {
    const harness = createPermissionTestHarness("auto_approve");
    const { child, stdio, promptPromise } = await runPromptWithPermissionRequest(harness);

    await expect(promptPromise).resolves.toEqual({ stopReason: "end_turn" });
    expect(harness.store.listPending()).toEqual([]);

    stdio.close();
    await once(child, "exit");
  });

  test("requires_approval blocks prompt until permission is resolved", async () => {
    const harness = createPermissionTestHarness("requires_approval");
    const { child, stdio, promptPromise } = await runPromptWithPermissionRequest(harness);

    await new Promise((resolve) => setTimeout(resolve, 25));

    const pending = harness.store.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      issueId: "issue-1",
      summary: "Run tests",
    });

    expect(harness.store.resolve(pending[0]!.id, "approve")).toBe(true);
    await expect(promptPromise).resolves.toEqual({ stopReason: "end_turn" });
    expect(harness.store.listPending()).toEqual([]);

    stdio.close();
    await once(child, "exit");
  });

  test("requires_approval deny still unblocks the agent with a reject option", async () => {
    const harness = createPermissionTestHarness("requires_approval");
    const { child, stdio, promptPromise } = await runPromptWithPermissionRequest(harness);

    await new Promise((resolve) => setTimeout(resolve, 25));

    const pending = harness.store.listPending();
    expect(pending).toHaveLength(1);

    expect(harness.store.resolve(pending[0]!.id, "deny")).toBe(true);
    await expect(promptPromise).resolves.toEqual({ stopReason: "end_turn" });

    stdio.close();
    await once(child, "exit");
  });
});

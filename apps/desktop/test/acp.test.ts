import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import type { ACPConfig } from "@symphony/core";
import { createPermissionRouter } from "@/runtime/acp/permission-router";
import { createPermissionStore } from "@/runtime/acp/permission-store";
import {
  createACPAdapter,
  type ACPAdapter,
  type StartRuntimeSessionInput,
} from "@/runtime/acp";

const demoServerPath = fileURLToPath(
  new URL("./fixtures/mock-acp-server.mjs", import.meta.url),
);

const tempDirs: string[] = [];

const defaultPromptTemplate = [
  "Issue: {{identifier}}",
  "Title: {{title}}",
  "{{description}}",
].join("\n");

function testACPConfig(overrides: Partial<ACPConfig> = {}): ACPConfig {
  return {
    command: process.execPath,
    args: [demoServerPath],
    permissionMode: "auto_approve",
    ...overrides,
  };
}

function createClientAdapterDeps() {
  const store = createPermissionStore();
  const router = createPermissionRouter({
    store,
    getPermissionMode: () => "auto_approve",
  });

  return {
    getPermissionRouter: () => router,
  };
}

function makeStartSessionInput(
  overrides: Partial<StartRuntimeSessionInput> &
    Pick<
      StartRuntimeSessionInput,
      "runAttemptId" | "issueId" | "attemptNumber" | "startedAt" | "workspacePath"
    >,
): StartRuntimeSessionInput {
  return {
    identifier: "SYM-1",
    title: "Test issue",
    description: null,
    promptTemplate: defaultPromptTemplate,
    ...overrides,
  };
}

function makeWorkspacePath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-acp-cwd-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

async function waitForTerminalStatus(
  adapter: ACPAdapter,
  sessionId: string,
  timeoutMs = 5000,
): Promise<"succeeded" | "failed" | "cancelled"> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const status = adapter.pollSessions(new Date().toISOString(), [sessionId])[0];
    if (status && status.status !== "running") {
      return status.status;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("timed out waiting for terminal status");
}

describe("createACPAdapter", () => {
  test("creates ACP client adapter", () => {
    const adapter = createACPAdapter(testACPConfig(), createClientAdapterDeps());

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-1",
        issueId: "issue-1",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    expect(session.status).toBe("running");
    expect(adapter.getSessionPhase(session.sessionId)).toBeTruthy();
  });

  test("requires permission router dependencies", () => {
    expect(() => createACPAdapter(testACPConfig())).toThrow(
      "ACP client adapter requires permission router dependencies",
    );
  });

  test("accepts issue context fields on startSession input", () => {
    const adapter = createACPAdapter(testACPConfig(), createClientAdapterDeps());
    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-ctx",
        issueId: "issue-ctx",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
        identifier: "SYM-42",
        title: "Add session context",
        description: "Issue body",
        promptTemplate: "Issue: {{identifier}}",
      }),
    );

    expect(session.issueId).toBe("issue-ctx");
  });

  test("completes demo ACP server session through factory", async () => {
    const adapter = createACPAdapter(testACPConfig(), createClientAdapterDeps());

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-factory",
        issueId: "issue-factory",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("succeeded");

    const snapshot = adapter.pollSessions(new Date().toISOString(), [session.sessionId])[0];
    expect(snapshot?.sessionRef).toMatch(/^[0-9a-f-]{36}$/);
    expect(snapshot?.errorMessage).toBeNull();
    expect(adapter.getSessionPhase(session.sessionId)).toBe("terminal");
    expect(adapter.getLastEventSummary(session.sessionId)).toBeTruthy();
  });

  test("cancels running sessions through factory", async () => {
    const adapter = createACPAdapter(testACPConfig(), createClientAdapterDeps());

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-cancel",
        issueId: "issue-cancel",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    const cancelled = adapter.cancelSession(session.sessionId, new Date().toISOString());
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.errorMessage).toBe("cancelled_by_reconciliation");
    expect(adapter.getSessionPhase(session.sessionId)).toBe("terminal");
  });
});

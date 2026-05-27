import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import type { ACPConfig } from "@symphony/core";
import {
  createPermissionRouter,
} from "@/runtime/acp/permission-router";
import { createPermissionStore } from "@/runtime/acp/permission-store";
import {
  ACP_RUNTIME_KIND,
  createAcpAdapter,
  runtimeKindFromAcpMode,
  type StartRuntimeSessionInput,
} from "@/runtime/acp";
import { createAcpClientAdapter } from "@/runtime/acp/acp-client-adapter";

const mockServerPath = fileURLToPath(
  new URL("./fixtures/mock-acp-server.mjs", import.meta.url),
);

const tempDirs: string[] = [];

const defaultPromptTemplate = [
  "Issue: {{identifier}}",
  "Title: {{title}}",
  "{{description}}",
].join("\n");

function testAcpConfig(overrides: Partial<ACPConfig> & Pick<ACPConfig, "mode">): ACPConfig {
  return {
    command: process.execPath,
    args: [],
    mockCompletionDelayMs: 100,
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

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeWorkspacePath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-acp-cwd-"));
  tempDirs.push(dir);
  return dir;
}

describe("acp adapter factory", () => {
  test("creates mock adapter when selected", () => {
    const adapter = createAcpAdapter(testAcpConfig({
      mode: "mock",
    }));

    const session = adapter.startSession(makeStartSessionInput({
      runAttemptId: "r1",
      issueId: "i1",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      workspacePath: makeWorkspacePath(),
    }));

    expect(session.runtimeKind).toBe(ACP_RUNTIME_KIND.mock);
  });

  test("creates acp client adapter when subprocess mode is selected", () => {
    const adapter = createAcpAdapter(
      testAcpConfig({
        mode: "subprocess",
        args: [mockServerPath],
      }),
      createClientAdapterDeps(),
    );

    const session = adapter.startSession(makeStartSessionInput({
      runAttemptId: "r1",
      issueId: "i1",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      workspacePath: makeWorkspacePath(),
    }));

    expect(session.runtimeKind).toBe(ACP_RUNTIME_KIND.subprocess);
  });

  test("requires permission router dependencies for subprocess mode", () => {
    expect(() =>
      createAcpAdapter(testAcpConfig({
        mode: "subprocess",
        args: [mockServerPath],
      })),
    ).toThrow("acp client adapter requires permission router dependencies");
  });

  test("accepts issue context fields on startSession input", () => {
    const adapter = createAcpAdapter(testAcpConfig({ mode: "mock" }));
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

  test("maps ACP mode to runtime kind", () => {
    expect(runtimeKindFromAcpMode("mock")).toBe(ACP_RUNTIME_KIND.mock);
    expect(runtimeKindFromAcpMode("subprocess")).toBe(ACP_RUNTIME_KIND.subprocess);
  });
});

describe("mock acp adapter", () => {
  test("transitions to succeeded after completion delay", () => {
    const adapter = createAcpAdapter(testAcpConfig({
      mode: "mock",
      mockCompletionDelayMs: 1000,
    }));
    const start = "2026-01-01T00:00:00.000Z";

    const session = adapter.startSession(makeStartSessionInput({
      runAttemptId: "run-1",
      issueId: "issue-1",
      attemptNumber: 1,
      startedAt: start,
      workspacePath: makeWorkspacePath(),
    }));
    expect(session.runtimeKind).toBe(ACP_RUNTIME_KIND.mock);

    const before = adapter.pollSessions("2026-01-01T00:00:00.500Z", [session.sessionId])[0];
    expect(before?.status).toBe("running");

    const after = adapter.pollSessions("2026-01-01T00:00:02.000Z", [session.sessionId])[0];
    expect(after?.status).toBe("succeeded");
  });

  test("uses deterministic fail heuristic for fail-tagged issues", () => {
    const adapter = createAcpAdapter(testAcpConfig({
      mode: "mock",
      mockCompletionDelayMs: 0,
    }));
    const session = adapter.startSession(makeStartSessionInput({
      runAttemptId: "run-fail-1",
      issueId: "issue-fail-fast",
      attemptNumber: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      workspacePath: makeWorkspacePath(),
    }));

    const terminal = adapter.pollSessions("2026-01-01T00:00:01.000Z", [session.sessionId])[0];
    expect(terminal?.status).toBe("failed");
    expect(terminal?.errorMessage).toBe("mock_acp_failure");
  });

  test("succeeds fail-tagged issues after attempt two", () => {
    const adapter = createAcpAdapter(testAcpConfig({
      mode: "mock",
      mockCompletionDelayMs: 0,
    }));
    const session = adapter.startSession(makeStartSessionInput({
      runAttemptId: "run-fail-3",
      issueId: "issue-fail-retry",
      attemptNumber: 3,
      startedAt: "2026-01-01T00:00:00.000Z",
      workspacePath: makeWorkspacePath(),
    }));

    const terminal = adapter.pollSessions("2026-01-01T00:00:01.000Z", [session.sessionId])[0];
    expect(terminal?.status).toBe("succeeded");
    expect(terminal?.errorMessage).toBeNull();
  });

  test("cancels running mock sessions", () => {
    const adapter = createAcpAdapter(testAcpConfig({
      mode: "mock",
      mockCompletionDelayMs: 60_000,
    }));
    const session = adapter.startSession(makeStartSessionInput({
      runAttemptId: "run-cancel",
      issueId: "issue-cancel",
      attemptNumber: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      workspacePath: makeWorkspacePath(),
    }));

    const cancelled = adapter.cancelSession(session.sessionId, "2026-01-01T00:00:01.000Z");
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.errorMessage).toBe("cancelled_by_reconciliation");

    const polled = adapter.pollSessions("2026-01-01T00:00:02.000Z", [session.sessionId])[0];
    expect(polled?.status).toBe("cancelled");
  });
});

async function waitForTerminalStatus(
  adapter: ReturnType<typeof createAcpAdapter>,
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

describe("acp client adapter", () => {
  test("marks session succeeded when mock acp server returns end_turn", async () => {
    const adapter = createAcpAdapter(
      testAcpConfig({
        mode: "subprocess",
        args: [mockServerPath],
      }),
      createClientAdapterDeps(),
    );

    const session = adapter.startSession(makeStartSessionInput({
      runAttemptId: "run-ok",
      issueId: "issue-ok",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      workspacePath: makeWorkspacePath(),
    }));

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("succeeded");

    const snapshot = adapter.pollSessions(new Date().toISOString(), [session.sessionId])[0];
    expect(snapshot?.sessionRef).toMatch(/^[0-9a-f-]{36}$/);
    expect(snapshot?.errorMessage).toBeNull();
  });

  test("runs session phases from spawning through terminal", async () => {
    const adapter = createAcpClientAdapter(
      testAcpConfig({
        mode: "subprocess",
        args: [mockServerPath],
      }),
      createClientAdapterDeps(),
    );

    const session = adapter.startSession(makeStartSessionInput({
      runAttemptId: "run-phases",
      issueId: "issue-phases",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      workspacePath: makeWorkspacePath(),
    }));

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("succeeded");
    expect(adapter.getSessionPhase(session.sessionId)).toBe("terminal");
    expect(adapter.getSessionUpdateCount(session.sessionId)).toBeGreaterThan(0);
  });

  test("requires workspace path for acp client sessions", () => {
    const adapter = createAcpAdapter(
      testAcpConfig({
        mode: "subprocess",
        args: [mockServerPath],
      }),
      createClientAdapterDeps(),
    );

    expect(() =>
      adapter.startSession(makeStartSessionInput({
        runAttemptId: "run-missing-cwd",
        issueId: "issue-missing-cwd",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: "   ",
      })),
    ).toThrow("workspacePath is required for acp client sessions");
  });

  test("cancels running acp client sessions", async () => {
    const adapter = createAcpClientAdapter(
      testAcpConfig({
        mode: "subprocess",
        args: [mockServerPath],
      }),
      createClientAdapterDeps(),
    );

    const session = adapter.startSession(makeStartSessionInput({
      runAttemptId: "run-cancel-client",
      issueId: "issue-cancel-client",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      workspacePath: makeWorkspacePath(),
    }));

    const cancelled = adapter.cancelSession(session.sessionId, new Date().toISOString());
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.errorMessage).toBe("cancelled_by_reconciliation");

    const polled = adapter.pollSessions(new Date().toISOString(), [session.sessionId])[0];
    expect(polled?.status).toBe("cancelled");
  });

  test("fails when child exits before protocol completion", async () => {
    const adapter = createAcpClientAdapter(
      testAcpConfig({
        mode: "subprocess",
        command: process.execPath,
        args: ["-e", "process.exit(1)"],
      }),
      createClientAdapterDeps(),
    );

    const session = adapter.startSession(makeStartSessionInput({
      runAttemptId: "run-early-exit",
      issueId: "issue-early-exit",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      workspacePath: makeWorkspacePath(),
    }));

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("failed");

    const polled = adapter.pollSessions(new Date().toISOString(), [session.sessionId])[0];
    expect(polled?.errorMessage).toMatch(/^early_process_exit_/);
  });
});

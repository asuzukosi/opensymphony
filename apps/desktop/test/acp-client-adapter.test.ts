import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import type { ACPConfig } from "@symphony/core";
import type { AppendSessionEventInput, SessionEventKind } from "@symphony/db";
import type { StartRuntimeSessionInput } from "@/runtime/acp";
import {
  createACPClientAdapter,
  type ACPClientAdapter,
} from "@/runtime/acp/acp-client-adapter";
import type { RuntimeSessionPhase } from "@/runtime/acp/types";
import { createPermissionRouter } from "@/runtime/acp/permission-router";
import { createPermissionStore } from "@/runtime/acp/permission-store";

const mockServerPath = fileURLToPath(
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
    args: [mockServerPath],
    permissionMode: "auto_approve",
    ...overrides,
  };
}

function createAdapterDeps(overrides: {
  appendSessionEvent?: (input: AppendSessionEventInput) => void;
} = {}) {
  const store = createPermissionStore();
  const router = createPermissionRouter({
    store,
    getPermissionMode: () => "auto_approve",
  });

  return {
    getPermissionRouter: () => router,
    ...overrides,
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
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-acp-client-adapter-"));
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
  adapter: ACPClientAdapter,
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

async function collectObservedPhases(
  adapter: ACPClientAdapter,
  sessionId: string,
  timeoutMs = 5000,
): Promise<Set<RuntimeSessionPhase>> {
  const phases = new Set<RuntimeSessionPhase>();
  const end = Date.now() + timeoutMs;

  while (Date.now() < end) {
    const phase = adapter.getSessionPhase(sessionId);
    if (phase) {
      phases.add(phase);
    }

    const record = adapter.pollSessions(new Date().toISOString(), [sessionId])[0];
    if (record?.status !== "running") {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  const terminalPhase = adapter.getSessionPhase(sessionId);
  if (terminalPhase) {
    phases.add(terminalPhase);
  }

  return phases;
}

describe("ACP client adapter lifecycle", () => {
  test("completes mock server session with agent session ref", async () => {
    const adapter = createACPClientAdapter(testACPConfig(), createAdapterDeps());

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-lifecycle",
        issueId: "issue-lifecycle",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    expect(session.status).toBe("running");

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("succeeded");

    const snapshot = adapter.pollSessions(new Date().toISOString(), [session.sessionId])[0];
    expect(snapshot?.sessionRef).toMatch(/^[0-9a-f-]{36}$/);
    expect(snapshot?.errorMessage).toBeNull();
    expect(adapter.getSessionPhase(session.sessionId)).toBe("terminal");
  });

  test("observes terminal phase after streaming updates complete", async () => {
    const adapter = createACPClientAdapter(testACPConfig(), createAdapterDeps());

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-phases",
        issueId: "issue-phases",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    const phases = await collectObservedPhases(adapter, session.sessionId);
    const status = await waitForTerminalStatus(adapter, session.sessionId);

    expect(status).toBe("succeeded");
    expect(phases.has("terminal")).toBe(true);
    expect(adapter.getSessionPhase(session.sessionId)).toBe("terminal");
    expect(adapter.getSessionUpdateCount(session.sessionId)).toBe(3);
  });

  test("records session/update stream from mock server", async () => {
    const adapter = createACPClientAdapter(testACPConfig(), createAdapterDeps());

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-updates",
        issueId: "issue-updates",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    await waitForTerminalStatus(adapter, session.sessionId);

    expect(adapter.getSessionUpdateCount(session.sessionId)).toBe(3);
  });

  test("persists prompt, stream, and tool session events", async () => {
    const events: AppendSessionEventInput[] = [];
    const adapter = createACPClientAdapter(
      testACPConfig(),
      createAdapterDeps({
        appendSessionEvent: (input) => {
          events.push(input);
        },
      }),
    );

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-events",
        issueId: "issue-events",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    await waitForTerminalStatus(adapter, session.sessionId);

    const kinds = events.map((event) => event.kind);
    expect(kinds).toContain("prompt");
    expect(kinds.filter((kind) => kind === "stream_chunk")).toHaveLength(2);
    expect(kinds).toContain("tool_call");
    expect(events.every((event) => event.sessionId === session.sessionId)).toBe(true);
  });

  test("persists consolidated stream events instead of raw chunks", async () => {
    const events: Array<{ kind: SessionEventKind; updateKind?: string }> = [];
    const adapter = createACPClientAdapter(
      testACPConfig(),
      createAdapterDeps({
        appendSessionEvent: (input) => {
          const payload = input.payload as { update?: { sessionUpdate?: string } };
          events.push({
            kind: input.kind,
            updateKind: payload.update?.sessionUpdate,
          });
        },
      }),
    );

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-consolidated-stream",
        issueId: "issue-consolidated-stream",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    await waitForTerminalStatus(adapter, session.sessionId);

    const streamEvents = events.filter((event) => event.kind === "stream_chunk");
    expect(streamEvents.every((event) => event.updateKind !== "agent_message_chunk")).toBe(true);
    expect(streamEvents.every((event) => event.updateKind !== "agent_thought_chunk")).toBe(true);
    expect(streamEvents.some((event) => event.updateKind === "agent_message")).toBe(true);
  });

  test("captures the final agent message for issue comments", async () => {
    const adapter = createACPClientAdapter(testACPConfig(), createAdapterDeps());

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-final-message",
        issueId: "issue-final-message",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    await waitForTerminalStatus(adapter, session.sessionId);

    expect(adapter.getLastAgentMessage(session.sessionId)).toContain("demo acp agent: done");
  });

  test("maps session/update kinds to persisted event kinds", async () => {
    const events: Array<{ kind: SessionEventKind; updateKind?: string }> = [];
    const adapter = createACPClientAdapter(
      testACPConfig(),
      createAdapterDeps({
        appendSessionEvent: (input) => {
          const payload = input.payload as { update?: { sessionUpdate?: string } };
          events.push({
            kind: input.kind,
            updateKind: payload.update?.sessionUpdate,
          });
        },
      }),
    );

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-event-kinds",
        issueId: "issue-event-kinds",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    await waitForTerminalStatus(adapter, session.sessionId);

    expect(events).toEqual(
      expect.arrayContaining([
        { kind: "stream_chunk", updateKind: "agent_message" },
        { kind: "tool_call", updateKind: "tool_call" },
      ]),
    );
  });

  test("requires workspace path", () => {
    const adapter = createACPClientAdapter(testACPConfig(), createAdapterDeps());

    expect(() =>
      adapter.startSession(
        makeStartSessionInput({
          runAttemptId: "run-missing-cwd",
          issueId: "issue-missing-cwd",
          attemptNumber: 1,
          startedAt: new Date().toISOString(),
          workspacePath: "   ",
        }),
      ),
    ).toThrow("workspacePath is required for ACP client sessions");
  });

  test("cancels running sessions", async () => {
    const adapter = createACPClientAdapter(testACPConfig(), createAdapterDeps());

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

    const polled = adapter.pollSessions(new Date().toISOString(), [session.sessionId])[0];
    expect(polled?.status).toBe("cancelled");
    expect(adapter.getSessionPhase(session.sessionId)).toBe("terminal");
  });

  test("pauses and resumes running sessions", async () => {
    const adapter = createACPClientAdapter(testACPConfig(), createAdapterDeps());

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-pause",
        issueId: "issue-pause",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    const paused = adapter.pauseSession(session.sessionId);
    expect(paused?.paused).toBe(true);
    expect(paused?.status).toBe("running");
    expect(adapter.getSessionPhase(session.sessionId)).toBe("paused");
    expect(adapter.isSessionPaused(session.sessionId)).toBe(true);

    const resumed = adapter.resumeSession(session.sessionId);
    expect(resumed?.paused).toBe(false);
    expect(adapter.isSessionPaused(session.sessionId)).toBe(false);
  });

  test("marks early child exit as failed with error events", async () => {
    const events: AppendSessionEventInput[] = [];
    const adapter = createACPClientAdapter(
      testACPConfig({
        command: process.execPath,
        args: ["-e", "process.exit(1)"],
      }),
      createAdapterDeps({
        appendSessionEvent: (input) => {
          events.push(input);
        },
      }),
    );

    const session = adapter.startSession(
      makeStartSessionInput({
        runAttemptId: "run-early-exit",
        issueId: "issue-early-exit",
        attemptNumber: 1,
        startedAt: new Date().toISOString(),
        workspacePath: makeWorkspacePath(),
      }),
    );

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("failed");

    const polled = adapter.pollSessions(new Date().toISOString(), [session.sessionId])[0];
    expect(polled?.errorMessage).toMatch(/^(early_process_exit_|ACP connection closed)/);
    expect(events.some((event) => event.kind === "error")).toBe(true);
    expect(adapter.getSessionPhase(session.sessionId)).toBe("terminal");
  });
});

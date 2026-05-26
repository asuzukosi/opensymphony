import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ACP_RUNTIME_KIND, createAcpAdapter, runtimeKindFromAcpMode } from "@/runtime/acp";

const tempDirs: string[] = [];

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
  test("creates subprocess adapter when selected", () => {
    const adapter = createAcpAdapter({
      mode: "subprocess",
      command: process.execPath,
      args: ["-e", "process.exit(0)"],
      mockCompletionDelayMs: 100,
    });

    const session = adapter.startSession({
      runAttemptId: "r1",
      issueId: "i1",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      workspacePath: makeWorkspacePath(),
    });

    expect(session.runtimeKind).toBe(ACP_RUNTIME_KIND.subprocess);
  });

  test("maps ACP mode to runtime kind", () => {
    expect(runtimeKindFromAcpMode("mock")).toBe(ACP_RUNTIME_KIND.mock);
    expect(runtimeKindFromAcpMode("subprocess")).toBe(ACP_RUNTIME_KIND.subprocess);
  });
});

describe("mock acp adapter", () => {
  test("transitions to succeeded after completion delay", () => {
    const adapter = createAcpAdapter({
      mode: "mock",
      command: process.execPath,
      args: [],
      mockCompletionDelayMs: 1000,
    });
    const start = "2026-01-01T00:00:00.000Z";

    const session = adapter.startSession({
      runAttemptId: "run-1",
      issueId: "issue-1",
      attemptNumber: 1,
      startedAt: start,
      workspacePath: makeWorkspacePath(),
    });
    expect(session.runtimeKind).toBe(ACP_RUNTIME_KIND.mock);

    const before = adapter.pollSessions("2026-01-01T00:00:00.500Z", [session.sessionId])[0];
    expect(before?.status).toBe("running");

    const after = adapter.pollSessions("2026-01-01T00:00:02.000Z", [session.sessionId])[0];
    expect(after?.status).toBe("succeeded");
  });

  test("uses deterministic fail heuristic for fail-tagged issues", () => {
    const adapter = createAcpAdapter({
      mode: "mock",
      command: process.execPath,
      args: [],
      mockCompletionDelayMs: 0,
    });
    const session = adapter.startSession({
      runAttemptId: "run-fail-1",
      issueId: "issue-fail-fast",
      attemptNumber: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      workspacePath: makeWorkspacePath(),
    });

    const terminal = adapter.pollSessions("2026-01-01T00:00:01.000Z", [session.sessionId])[0];
    expect(terminal?.status).toBe("failed");
    expect(terminal?.errorMessage).toBe("mock_acp_failure");
  });
});

async function waitForTerminalStatus(
  adapter: ReturnType<typeof createAcpAdapter>,
  sessionId: string,
  timeoutMs = 2000,
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

describe("subprocess acp adapter", () => {
  test("marks session succeeded when subprocess exits 0", async () => {
    const adapter = createAcpAdapter({
      mode: "subprocess",
      command: process.execPath,
      args: ["-e", "setTimeout(() => process.exit(0), 25)"],
      mockCompletionDelayMs: 100,
    });

    const session = adapter.startSession({
      runAttemptId: "run-ok",
      issueId: "issue-ok",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      workspacePath: makeWorkspacePath(),
    });

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("succeeded");
  });

  test("marks session failed when subprocess exits non-zero", async () => {
    const adapter = createAcpAdapter({
      mode: "subprocess",
      command: process.execPath,
      args: ["-e", 'process.stderr.write("boom"); process.exit(2)'],
      mockCompletionDelayMs: 100,
    });

    const session = adapter.startSession({
      runAttemptId: "run-fail",
      issueId: "issue-fail",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      workspacePath: makeWorkspacePath(),
    });

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("failed");

    const snapshot = adapter.pollSessions(new Date().toISOString(), [session.sessionId])[0];
    expect(snapshot?.errorMessage).toContain("exit_2");
  });

  test("spawns subprocess with issue workspace cwd", async () => {
    const workspacePath = makeWorkspacePath();
    const markerPath = path.join(workspacePath, "cwd.txt");
    const adapter = createAcpAdapter({
      mode: "subprocess",
      command: process.execPath,
      args: ["-e", "require('fs').writeFileSync('cwd.txt', process.cwd())"],
      mockCompletionDelayMs: 100,
    });

    const session = adapter.startSession({
      runAttemptId: "run-cwd",
      issueId: "issue-cwd",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
      workspacePath,
    });

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("succeeded");
    expect(realpathSync(readFileSync(markerPath, "utf8"))).toBe(realpathSync(workspacePath));
  });
});

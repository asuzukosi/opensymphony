import { describe, expect, test } from "vitest";
import { AcpCliRuntimeAdapter } from "@/runtime/acp-cli-runtime-adapter";

async function waitForTerminalStatus(
  adapter: AcpCliRuntimeAdapter,
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
  throw new Error("Timed out waiting for terminal status");
}

describe("acp-cli runtime adapter", () => {
  test("marks session succeeded when subprocess exits 0", async () => {
    const adapter = new AcpCliRuntimeAdapter({
      command: process.execPath,
      args: ["-e", "setTimeout(() => process.exit(0), 25)"],
    });

    const session = adapter.startSession({
      runAttemptId: "run-ok",
      issueId: "issue-ok",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
    });

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("succeeded");
  });

  test("marks session failed when subprocess exits non-zero", async () => {
    const adapter = new AcpCliRuntimeAdapter({
      command: process.execPath,
      args: ["-e", 'process.stderr.write("boom"); process.exit(2)'],
    });

    const session = adapter.startSession({
      runAttemptId: "run-fail",
      issueId: "issue-fail",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
    });

    const status = await waitForTerminalStatus(adapter, session.sessionId);
    expect(status).toBe("failed");

    const snapshot = adapter.pollSessions(new Date().toISOString(), [session.sessionId])[0];
    expect(snapshot?.errorMessage).toContain("exit_2");
  });
});

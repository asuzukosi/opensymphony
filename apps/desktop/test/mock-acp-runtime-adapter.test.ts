import { describe, expect, test } from "vitest";
import { MockAcpRuntimeAdapter } from "@/runtime/mock-acp-runtime-adapter";

describe("mock ACP runtime adapter", () => {
  test("transitions to succeeded after completion delay", () => {
    const adapter = new MockAcpRuntimeAdapter(1000);
    const start = "2026-01-01T00:00:00.000Z";

    const session = adapter.startSession({
      runAttemptId: "run-1",
      issueId: "issue-1",
      attemptNumber: 1,
      startedAt: start,
    });

    const before = adapter.pollSessions("2026-01-01T00:00:00.500Z", [session.sessionId])[0];
    expect(before?.status).toBe("running");

    const after = adapter.pollSessions("2026-01-01T00:00:02.000Z", [session.sessionId])[0];
    expect(after?.status).toBe("succeeded");
  });

  test("uses deterministic fail heuristic for fail-tagged issues", () => {
    const adapter = new MockAcpRuntimeAdapter(0);
    const session = adapter.startSession({
      runAttemptId: "run-fail-1",
      issueId: "issue-fail-fast",
      attemptNumber: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
    });

    const terminal = adapter.pollSessions("2026-01-01T00:00:01.000Z", [session.sessionId])[0];
    expect(terminal?.status).toBe("failed");
    expect(terminal?.errorMessage).toBe("mock_acp_failure");
  });
});

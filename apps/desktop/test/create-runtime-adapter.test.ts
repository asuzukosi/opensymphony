import { describe, expect, test } from "vitest";
import { createRuntimeAdapter } from "@/runtime/create-runtime-adapter";

describe("runtime adapter factory", () => {
  test("creates acp-cli adapter when selected", () => {
    const adapter = createRuntimeAdapter({
      kind: "acp-cli",
      completionDelayMs: 100,
      acpCliCommand: process.execPath,
      acpCliArgs: ["-e", "process.exit(0)"],
    });

    const session = adapter.startSession({
      runAttemptId: "r1",
      issueId: "i1",
      attemptNumber: 1,
      startedAt: new Date().toISOString(),
    });

    expect(session.runtimeKind).toBe("acp-cli");
  });
});

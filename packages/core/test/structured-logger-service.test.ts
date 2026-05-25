import { describe, expect, test, vi } from "vitest";
import { StructuredLoggerService } from "@core/services/structured-logger-service";

describe("StructuredLoggerService", () => {
  test("writes JSON log line with required context fields", () => {
    const logger = new StructuredLoggerService();
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logger.info({
      event: "orchestrator_tick",
      message: "tick completed",
      projectId: "p1",
      issueId: "i1",
      issueIdentifier: "P1-1",
      runAttemptId: "i1:attempt:1",
      sessionId: "s1",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line) as { event: string; level: string; projectId: string };
    expect(parsed.event).toBe("orchestrator_tick");
    expect(parsed.level).toBe("info");
    expect(parsed.projectId).toBe("p1");

    spy.mockRestore();
  });
});

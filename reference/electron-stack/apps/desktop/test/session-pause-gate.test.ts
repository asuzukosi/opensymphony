import { describe, expect, test } from "vitest";
import { SessionPauseGate } from "@/runtime/acp/session-pause-gate";

describe("session pause gate", () => {
  test("blocks waiters until resumed", async () => {
    const gate = new SessionPauseGate();
    gate.pause();

    let released = false;
    const waiting = gate.waitIfPaused().then(() => {
      released = true;
    });

    await Promise.race([
      waiting,
      new Promise((resolve) => setTimeout(resolve, 20)),
    ]);
    expect(released).toBe(false);

    gate.resume();
    await waiting;
    expect(released).toBe(true);
  });
});

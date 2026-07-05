// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AgentRunningCard } from "@/renderer/components/agent-running-card";
import type { RuntimeRunningEntry } from "@/ipc";

function makeEntry(overrides: Partial<RuntimeRunningEntry> = {}): RuntimeRunningEntry {
  return {
    runAttemptId: "run-1",
    issueId: "issue-1",
    identifier: "P1-1",
    attemptNumber: 1,
    startedAt: "2026-01-01T00:00:00.000Z",
    sessionId: "session-12345678",
    sessionStatus: "running",
    phase: null,
    lastEventSummary: null,
    paused: false,
    ...overrides,
  };
}

describe("AgentRunningCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderCard(entry: RuntimeRunningEntry): Promise<void> {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(AgentRunningCard, { entry }),
        ),
      );
    });
  }

  test("renders phase and last event summary when present", async () => {
    await renderCard(
      makeEntry({
        phase: "streaming",
        lastEventSummary: "tool_call",
      }),
    );

    expect(container.textContent).toContain("streaming");
    expect(container.textContent).toContain("Last event: tool call");
    expect(container.textContent).toContain("running");
  });

  test("omits phase and last event lines when snapshot fields are null", async () => {
    await renderCard(makeEntry());

    expect(container.textContent).not.toContain("Last event:"); 
    expect(container.textContent).not.toContain("prompting");
  });
});

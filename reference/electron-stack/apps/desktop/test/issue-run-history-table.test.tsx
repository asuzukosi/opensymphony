// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { IssueRunHistoryTable } from "@/renderer/components/issue-run-history-table";
import type { IssueDetailRunAttempt, SessionEvent } from "@/ipc";

function makeEvent(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    id: "event-1",
    kind: "prompt",
    payload: { text: "Run the issue." },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAttempt(overrides: Partial<IssueDetailRunAttempt> = {}): IssueDetailRunAttempt {
  return {
    runAttemptId: "run-1",
    attemptNumber: 1,
    status: "succeeded",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:05:00.000Z",
    errorMessage: null,
    sessions: [],
    ...overrides,
  };
}

describe("IssueRunHistoryTable", () => {
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

  async function renderTable(
    attempts?: IssueDetailRunAttempt[],
    sessionEvents: SessionEvent[] = [],
    isLoading = false,
  ): Promise<void> {
    await act(async () => {
      root.render(
        createElement(IssueRunHistoryTable, {
          attempts,
          sessionEvents,
          isLoading,
        }),
      );
    });
  }

  test("renders run history and session timeline sections", async () => {
    await renderTable([makeAttempt()], [makeEvent()]);

    expect(container.textContent).toContain("Run history");
    expect(container.textContent).toContain("Session timeline");
    expect(container.textContent).toContain("Run the issue.");
  });

  test("shows timeline empty state when there are no session events", async () => {
    await renderTable([makeAttempt()], []);

    expect(container.textContent).toContain("Session events will appear here after an agent run records activity.");
  });
});

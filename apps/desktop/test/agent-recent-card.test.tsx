// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AgentRecentCard } from "@/renderer/components/agent-recent-card";
import type { RuntimeRecentFinishedEntry } from "@/ipc";

function makeEntry(
  overrides: Partial<RuntimeRecentFinishedEntry> = {},
): RuntimeRecentFinishedEntry {
  return {
    runAttemptId: "run-1",
    issueId: "issue-1",
    identifier: "SYM-1",
    attemptNumber: 1,
    status: "succeeded",
    finishedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    reviewStatus: null,
    ...overrides,
  };
}

describe("AgentRecentCard", () => {
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

  async function renderCard(entry: RuntimeRecentFinishedEntry): Promise<void> {
    await act(async () => {
      root.render(
        createElement(MemoryRouter, null, createElement(AgentRecentCard, { entry })),
      );
    });
  }

  test("shows pending review tag for succeeded runs awaiting approval", async () => {
    await renderCard(
      makeEntry({
        reviewStatus: "pending_review",
      }),
    );

    expect(container.textContent).toContain("Pending review");
    expect(container.textContent).toContain("succeeded");
  });

  test("shows approved tag for succeeded runs moved to done", async () => {
    await renderCard(
      makeEntry({
        reviewStatus: "approved",
      }),
    );

    expect(container.textContent).toContain("Approved");
  });

  test("does not show review tag for failed runs", async () => {
    await renderCard(
      makeEntry({
        status: "failed",
        errorMessage: "boom",
        reviewStatus: null,
      }),
    );

    expect(container.textContent).not.toContain("Pending review");
    expect(container.textContent).not.toContain("Approved");
    expect(container.textContent).toContain("failed");
  });
});

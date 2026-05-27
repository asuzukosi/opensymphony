// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { IssueSessionTimeline } from "@/renderer/components/issue-session-timeline";
import type { SessionEvent } from "@/ipc";

function makeEvent(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    id: "event-1",
    kind: "prompt",
    payload: { text: "Run the issue." },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("IssueSessionTimeline", () => {
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

  async function renderTimeline(
    events: SessionEvent[],
    options?: { isLoading?: boolean; emptyMessage?: string },
  ): Promise<void> {
    await act(async () => {
      root.render(
        createElement(IssueSessionTimeline, {
          events,
          isLoading: options?.isLoading,
          emptyMessage: options?.emptyMessage,
        }),
      );
    });
  }

  test("renders empty state when there are no events", async () => {
    await renderTimeline([], { emptyMessage: "No events yet." });

    expect(container.textContent).toContain("No events yet.");
  });

  test("renders loading skeleton", async () => {
    await renderTimeline([], { isLoading: true });

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  test("renders prompt events", async () => {
    await renderTimeline([makeEvent({ kind: "prompt", payload: { text: "Fix the bug" } })]);

    expect(container.textContent).toContain("Prompt");
    expect(container.textContent).toContain("Fix the bug");
  });

  test("renders stream chunk text from session update payload", async () => {
    await renderTimeline([
      makeEvent({
        id: "event-stream",
        kind: "stream_chunk",
        payload: {
          sessionId: "session-1",
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "working on it" },
          },
        },
      }),
    ]);

    expect(container.textContent).toContain("Stream");
    expect(container.textContent).toContain("working on it");
  });

  test("renders tool call details", async () => {
    await renderTimeline([
      makeEvent({
        id: "event-tool",
        kind: "tool_call",
        payload: {
          sessionId: "session-1",
          update: {
            sessionUpdate: "tool_call",
            toolCallId: "tool-1",
            title: "Run tests",
            kind: "execute",
            status: "completed",
          },
        },
      }),
    ]);

    expect(container.textContent).toContain("Tool");
    expect(container.textContent).toContain("Run tests");
    expect(container.textContent).toContain("execute");
    expect(container.textContent).toContain("completed");
  });

  test("renders permission request and resolve events", async () => {
    await renderTimeline([
      makeEvent({
        id: "event-perm-req",
        kind: "permission_request",
        payload: {
          sessionId: "session-1",
          toolCall: { toolCallId: "tool-1", title: "Run tests", kind: "execute", status: "pending" },
          options: [],
        },
      }),
      makeEvent({
        id: "event-perm-res",
        kind: "permission_resolve",
        payload: {
          request: {
            sessionId: "session-1",
            toolCall: { toolCallId: "tool-1", title: "Run tests", kind: "execute", status: "pending" },
            options: [{ optionId: "allow-once", name: "Allow once", kind: "allow_once" }],
          },
          response: {
            outcome: { outcome: "selected", optionId: "allow-once" },
          },
        },
      }),
    ]);

    expect(container.textContent).toContain("Permission");
    expect(container.textContent).toContain("Run tests");
    expect(container.textContent).toContain("Decision");
    expect(container.textContent).toContain("Approved: Run tests");
  });

  test("renders error events", async () => {
    await renderTimeline([
      makeEvent({
        id: "event-error",
        kind: "error",
        payload: { message: "early_process_exit_1" },
      }),
    ]);

    expect(container.textContent).toContain("Error");
    expect(container.textContent).toContain("early_process_exit_1");
  });
});

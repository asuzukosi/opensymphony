import { describe, expect, test } from "vitest";
import type { SessionEventKind } from "@symphony/db";
import {
  createStreamBuffers,
  flushStreamBuffers,
  handleSessionUpdateForPersistence,
  shouldPersistSessionUpdate,
} from "@/runtime/acp/session-event-recorder";

function makeNotification(update: Record<string, unknown>) {
  return {
    sessionId: "agent-session-1",
    update,
  } as never;
}

describe("session event recorder", () => {
  test("does not persist streaming chunk updates", () => {
    expect(
      shouldPersistSessionUpdate({
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "thinking" },
      } as never),
    ).toBe(false);
    expect(
      shouldPersistSessionUpdate({
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "hello" },
      } as never),
    ).toBe(false);
    expect(
      shouldPersistSessionUpdate({
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "hi" },
      } as never),
    ).toBe(false);
  });

  test("persists tool calls and terminal tool updates only", () => {
    expect(
      shouldPersistSessionUpdate({
        sessionUpdate: "tool_call",
        toolCallId: "tool-1",
        title: "Run tests",
        kind: "execute",
        status: "in_progress",
      } as never),
    ).toBe(true);
    expect(
      shouldPersistSessionUpdate({
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-1",
        status: "in_progress",
      } as never),
    ).toBe(false);
    expect(
      shouldPersistSessionUpdate({
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-1",
        status: "completed",
      } as never),
    ).toBe(true);
  });

  test("buffers thought chunks and flushes a full thought before tool calls", () => {
    const events: Array<{ kind: SessionEventKind; payload: unknown }> = [];
    const buffers = createStreamBuffers();
    const persist = (kind: SessionEventKind, payload: unknown) => {
      events.push({ kind, payload });
    };

    handleSessionUpdateForPersistence({
      params: makeNotification({
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "plan " },
      }),
      buffers,
      persist,
    });
    handleSessionUpdateForPersistence({
      params: makeNotification({
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "the fix" },
      }),
      buffers,
      persist,
    });
    handleSessionUpdateForPersistence({
      params: makeNotification({
        sessionUpdate: "tool_call",
        toolCallId: "tool-1",
        title: "grep",
        kind: "search",
        status: "in_progress",
      }),
      buffers,
      persist,
    });

    expect(events).toEqual([
      {
        kind: "stream_chunk",
        payload: {
          update: {
            sessionUpdate: "agent_thought",
            content: { type: "text", text: "plan the fix" },
          },
        },
      },
      {
        kind: "tool_call",
        payload: makeNotification({
          sessionUpdate: "tool_call",
          toolCallId: "tool-1",
          title: "grep",
          kind: "search",
          status: "in_progress",
        }),
      },
    ]);
  });

  test("buffers message chunks and flushes a full message at session end", () => {
    const events: Array<{ kind: SessionEventKind; payload: unknown }> = [];
    const buffers = createStreamBuffers();
    const persist = (kind: SessionEventKind, payload: unknown) => {
      events.push({ kind, payload });
    };

    handleSessionUpdateForPersistence({
      params: makeNotification({
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "done" },
      }),
      buffers,
      persist,
    });
    handleSessionUpdateForPersistence({
      params: makeNotification({
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: " for now" },
      }),
      buffers,
      persist,
    });
    flushStreamBuffers(buffers, persist);

    expect(events).toEqual([
      {
        kind: "stream_chunk",
        payload: {
          update: {
            sessionUpdate: "agent_message",
            content: { type: "text", text: "done for now" },
          },
        },
      },
    ]);
  });
});

import { describe, expect, test } from "vitest";
import {
  commitAgentMessageSegment,
  createAgentMessageTracker,
  resolveLastAgentMessage,
  trackAgentMessageFromUpdate,
} from "@/runtime/acp/agent-message-tracker";

describe("agent message tracker", () => {
  test("keeps the last completed agent message segment", () => {
    const tracker = createAgentMessageTracker();

    trackAgentMessageFromUpdate(tracker, {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "starting work" },
    } as never);
    trackAgentMessageFromUpdate(tracker, {
      sessionUpdate: "tool_call",
      toolCallId: "tool-1",
      title: "read file",
      kind: "read",
      status: "in_progress",
    } as never);
    trackAgentMessageFromUpdate(tracker, {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "done for now" },
    } as never);

    expect(resolveLastAgentMessage(tracker)).toBe("done for now");
  });

  test("ignores thought chunks when tracking final message", () => {
    const tracker = createAgentMessageTracker();

    trackAgentMessageFromUpdate(tracker, {
      sessionUpdate: "agent_thought_chunk",
      content: { type: "text", text: "planning" },
    } as never);
    trackAgentMessageFromUpdate(tracker, {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "summary" },
    } as never);

    commitAgentMessageSegment(tracker);
    expect(tracker.lastCompleteMessage).toBe("summary");
  });
});

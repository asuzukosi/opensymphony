import { describe, expect, test } from "vitest";
import {
  ACP_BASELINE_CLIENT_CAPABILITIES,
  ACP_METHOD,
  AGENT_METHODS,
  CLIENT_METHODS,
  defaultInitializeRequest,
  defaultSymphonyClientCapabilities,
  getSessionUpdateKind,
  ndJsonStream,
  PROTOCOL_VERSION,
  SYMPHONY_CLIENT_INFO,
} from "@/runtime/acp/acp-protocol";

describe("acp-protocol", () => {
  test("re-exports official sdk method constants", () => {
    expect(AGENT_METHODS.initialize).toBe("initialize");
    expect(AGENT_METHODS.session_new).toBe("session/new");
    expect(AGENT_METHODS.session_prompt).toBe("session/prompt");
    expect(CLIENT_METHODS.session_request_permission).toBe("session/request_permission");
    expect(CLIENT_METHODS.fs_read_text_file).toBe("fs/read_text_file");
    expect(CLIENT_METHODS.terminal_create).toBe("terminal/create");
    expect(CLIENT_METHODS.session_update).toBe("session/update");
    expect(AGENT_METHODS.session_cancel).toBe("session/cancel");
    expect(ACP_METHOD.session_new).toBe("session/new");
  });

  test("default client capabilities are empty", () => {
    const capabilities = defaultSymphonyClientCapabilities();
    expect(capabilities).toEqual(ACP_BASELINE_CLIENT_CAPABILITIES);
    expect(capabilities).toEqual({});
  });

  test("builds default initialize request with symphony client capabilities", () => {
    const request = defaultInitializeRequest();
    expect(request.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(request.clientInfo).toEqual(SYMPHONY_CLIENT_INFO);
    expect(request.clientCapabilities).toEqual(ACP_BASELINE_CLIENT_CAPABILITIES);
  });

  test("reads session update discriminator from sdk union", () => {
    expect(
      getSessionUpdateKind({
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "hello" },
      }),
    ).toBe("agent_message_chunk");
  });

  test("exports ndjson stream helper from sdk", () => {
    expect(typeof ndJsonStream).toBe("function");
  });
});

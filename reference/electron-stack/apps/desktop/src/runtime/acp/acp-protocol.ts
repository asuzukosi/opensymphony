/** symphony re-exports and defaults for @agentclientprotocol/sdk. */

export {
  AGENT_METHODS,
  CLIENT_METHODS,
  PROTOCOL_VERSION,
} from "@agentclientprotocol/sdk";

export type {
  CancelNotification,
  Client,
  ClientCapabilities,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  RequestPermissionOutcome,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionId,
  SessionNotification,
  SessionUpdate,
  StopReason,
  ToolCallId,
} from "@agentclientprotocol/sdk";

export {
  ClientSideConnection,
  ndJsonStream,
  RequestError,
  type Agent,
  type Stream,
} from "@agentclientprotocol/sdk";

import {
  AGENT_METHODS,
  CLIENT_METHODS,
  PROTOCOL_VERSION,
  type ClientCapabilities,
  type InitializeRequest,
  type SessionUpdate,
} from "@agentclientprotocol/sdk";

export const SYMPHONY_CLIENT_INFO = {
  name: "symphony",
  version: "0.1.0",
} as const;

export const ACP_METHOD = {
  ...AGENT_METHODS,
  ...CLIENT_METHODS,
} as const;

export type ACPMethodName = (typeof ACP_METHOD)[keyof typeof ACP_METHOD];

export const ACP_BASELINE_CLIENT_CAPABILITIES: ClientCapabilities = {};

export function defaultSymphonyClientCapabilities(): ClientCapabilities {
  return { ...ACP_BASELINE_CLIENT_CAPABILITIES };
}

export function defaultInitializeRequest(
  overrides: Partial<InitializeRequest> = {},
): InitializeRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: defaultSymphonyClientCapabilities(),
    clientInfo: { ...SYMPHONY_CLIENT_INFO },
    ...overrides,
  };
}

export function getSessionUpdateKind(update: SessionUpdate): SessionUpdate["sessionUpdate"] {
  return update.sessionUpdate;
}

/**
 * Symphony integration with the official ACP TypeScript SDK.
 * @see https://agentclientprotocol.github.io/typescript-sdk/
 */

export {
  AGENT_METHODS,
  CLIENT_METHODS,
  PROTOCOL_VERSION,
} from "@agentclientprotocol/sdk";

export type {
  AuthCapabilities,
  CancelNotification,
  Client,
  ClientCapabilities,
  ClientNesCapabilities,
  CreateTerminalRequest,
  CreateTerminalResponse,
  ElicitationCapabilities,
  FileSystemCapabilities,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  PositionEncodingKind,
  PromptRequest,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RequestPermissionOutcome,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionId,
  SessionNotification,
  SessionUpdate,
  StopReason,
  TerminalExitStatus,
  TerminalOutputRequest,
  TerminalOutputResponse,
  ToolCallId,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
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

/** Combined ACP method names from the official SDK schema. */
export const ACP_METHOD = {
  ...AGENT_METHODS,
  ...CLIENT_METHODS,
} as const;

export type ACPMethodName = (typeof ACP_METHOD)[keyof typeof ACP_METHOD];

/**
 * Keys on {@link ClientCapabilities} beyond the stable baseline (`fs`, `terminal`).
 * Each group is experimental in the SDK unless noted — do not advertise until Symphony
 * implements the matching client handlers.
 */
export const ACP_EXPERIMENTAL_CLIENT_CAPABILITY_GROUPS = {
  /** Agent auth methods the client can host (e.g. terminal-based credential entry). */
  auth: "auth",
  /** Structured user input via form or URL elicitation flows. */
  elicitation: "elicitation",
  /** Next Edit Suggestions (jump, rename, search-and-replace). */
  nes: "nes",
  /** Preferred text position encodings for editor-integrated agents. */
  positionEncodings: "positionEncodings",
} as const;

/**
 * Stable ACP client capabilities Symphony implements in v1.
 * Agents may call `fs/*` and `terminal/*` client methods when these are set.
 */
export const ACP_BASELINE_CLIENT_CAPABILITIES: ClientCapabilities = {
  fs: {
    readTextFile: true,
    writeTextFile: true,
  },
  terminal: true,
};

/**
 * Default {@link ClientCapabilities} advertised during ACP `initialize`.
 * Uses the stable baseline only; experimental groups stay off until implemented.
 */
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

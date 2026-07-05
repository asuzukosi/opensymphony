import type { RuntimeConfig } from "@core/types/workflow";
import { DEMO_ACP_SERVER_PATH } from "./demo-acp-server-path";

export function makeOrchestratorRuntimeConfig(
  overrides: Partial<RuntimeConfig> = {},
): RuntimeConfig {
  return {
    projectId: "p1",
    maxConcurrency: 2,
    pollIntervalMs: 3_000,
    retryMaxBackoffMs: 30_000,
    workspaceRoot: ".symphony-workspaces",
    acp: {
      command: process.execPath,
      args: [DEMO_ACP_SERVER_PATH],
      permissionMode: "auto_approve",
    },
    hooks: {
      afterCreate: [],
      beforeAgentRun: [],
      afterRun: [],
      beforeRemove: [],
      timeoutMs: 60_000,
    },
    ...overrides,
  };
}

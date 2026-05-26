import type { RuntimeConfig } from "@core/types/workflow";

export function makeOrchestratorRuntimeConfig(
  overrides: Partial<RuntimeConfig> = {},
): RuntimeConfig {
  return {
    projectId: "p1",
    maxConcurrency: 2,
    pollIntervalMs: 30_000,
    retryMaxBackoffMs: 30_000,
    workspaceRoot: ".symphony-workspaces",
    acp: {
      mode: "mock",
      command: process.execPath,
      args: ["-e", "setTimeout(() => process.exit(0), 1200)"],
      mockCompletionDelayMs: 1_200,
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

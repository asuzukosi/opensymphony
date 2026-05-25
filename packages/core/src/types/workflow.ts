export interface WorkflowDefinition {
  config: Record<string, unknown>;
  promptTemplate: string;
}

export type RuntimeAdapterKind = "mock-acp" | "acp-cli";

export interface RuntimeAdapterConfig {
  kind: RuntimeAdapterKind;
  completionDelayMs: number;
  acpCliCommand: string;
  acpCliArgs: string[];
}

export interface RuntimeConfig {
  tracker: {
    kind: "db" | "linear";
    linearApiUrl: string;
    linearTokenEnvVar: string;
    linearTeamId: string;
  };
  projectId: string;
  pollIntervalMs: number;
  maxConcurrency: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  activeStateCategories: string[];
  runtimeAdapter: RuntimeAdapterConfig;
  workspaceRoot: string;
  hooks: {
    afterCreate: string[];
    beforeAgentRun: string[];
    afterRun: string[];
    beforeRemove: string[];
    timeoutMs: number;
  };
}

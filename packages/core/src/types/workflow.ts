export interface WorkflowDefinition {
  config: Record<string, unknown>;
  promptTemplate: string;
}

export type ACPMode = "mock" | "subprocess";

export type PermissionMode = "auto_approve" | "requires_approval";

export interface ACPConfig {
  mode: ACPMode;
  command: string;
  args: string[];
  mockCompletionDelayMs: number;
  permissionMode: PermissionMode;
}

export interface RuntimeHooksConfig {
  afterCreate: string[];
  beforeAgentRun: string[];
  afterRun: string[];
  beforeRemove: string[];
  timeoutMs: number;
}

export interface RuntimeConfig {
  projectId: string;
  pollIntervalMs: number;
  maxConcurrency: number;
  retryMaxBackoffMs: number;
  workspaceRoot: string;
  hooks: RuntimeHooksConfig;
  acp: ACPConfig;
}

export const DEFAULT_RETRY_BASE_DELAY_MS = 10_000;

export const DEFAULT_ACTIVE_STATE_CATEGORIES = ["active", "backlog"] as const;

export type RuntimeConfigValidationField = "project_id" | "acp.mode";

export interface RuntimeConfigValidationError {
  field: RuntimeConfigValidationField;
  message: string;
}

export interface RuntimeConfigValidationResult {
  valid: boolean;
  errors: RuntimeConfigValidationError[];
}

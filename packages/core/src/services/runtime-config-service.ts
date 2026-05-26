import type {
  ACPMode,
  RuntimeConfig,
  RuntimeConfigValidationError,
  RuntimeConfigValidationField,
  RuntimeConfigValidationResult,
  WorkflowDefinition,
} from "@core/types/workflow";

export type {
  RuntimeConfigValidationError,
  RuntimeConfigValidationField,
  RuntimeConfigValidationResult,
};

export function validateRuntimeConfig(definition: WorkflowDefinition): RuntimeConfigValidationResult {
  const errors: RuntimeConfigValidationError[] = [];
  const config = definition.config;
  const acp = config.acp;

  if (typeof config.project_id !== "string" || config.project_id.trim().length === 0) {
    errors.push({
      field: "project_id",
      message: "Missing required config: project_id",
    });
  }

  if (!acp || typeof acp !== "object" || Array.isArray(acp)) {
    errors.push({
      field: "acp.mode",
      message: "Missing required config: acp.mode",
    });
  } else {
    const mode = (acp as Record<string, unknown>).mode;
    if (mode !== "mock" && mode !== "subprocess") {
      errors.push({
        field: "acp.mode",
        message: "Invalid config: acp.mode must be mock or subprocess",
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function formatRuntimeConfigValidationErrors(
  errors: RuntimeConfigValidationError[],
): string {
  return errors.map((error) => error.message).join("; ");
}

interface RuntimeConfigDefaults {
  pollIntervalMs: number;
  maxConcurrency: number;
  retryMaxBackoffMs: number;
  hookTimeoutMs: number;
}

const DEFAULTS: RuntimeConfigDefaults = {
  pollIntervalMs: 30_000,
  maxConcurrency: 3,
  retryMaxBackoffMs: 300_000,
  hookTimeoutMs: 60_000,
};

const DEFAULT_ACP = {
  mode: "mock" as const,
  mockCompletionDelayMs: 1200,
  command: process.execPath,
  args: ["-e", "setTimeout(() => process.exit(0), 1200)"],
};

export class RuntimeConfigService {
  toRuntimeConfig(definition: WorkflowDefinition): RuntimeConfig {
    const config = definition.config;
    const acp = this.asObject(config.acp);
    const hooks = this.asObject(config.hooks);
    const workspace = this.asObject(config.workspace);

    const projectId = this.readString(config.project_id, "project_id");
    const pollIntervalMs = this.readPositiveInt(config.poll_interval_ms, DEFAULTS.pollIntervalMs);
    const maxConcurrency = this.readPositiveInt(config.max_concurrency, DEFAULTS.maxConcurrency);
    const retryMaxBackoffMs = this.readPositiveInt(
      config.retry_max_backoff_ms,
      DEFAULTS.retryMaxBackoffMs,
    );
    const workspaceRoot = this.readStringOrFallback(
      config.workspace_root ?? workspace.root,
      ".symphony-workspaces",
    );
    const hookTimeoutMs = this.readPositiveInt(hooks.timeout_ms, DEFAULTS.hookTimeoutMs);

    return {
      projectId,
      pollIntervalMs,
      maxConcurrency,
      retryMaxBackoffMs,
      workspaceRoot,
      acp: {
        mode: this.readACPMode(acp.mode),
        command: this.readStringOrFallback(acp.command, DEFAULT_ACP.command),
        args: this.readStringArray(acp.args, DEFAULT_ACP.args),
        mockCompletionDelayMs: this.readPositiveInt(
          acp.mock_completion_delay_ms,
          DEFAULT_ACP.mockCompletionDelayMs,
        ),
      },
      hooks: {
        afterCreate: this.readStringArray(hooks.after_create, []),
        beforeAgentRun: this.readStringArray(hooks.before_agent_run, []),
        afterRun: this.readStringArray(hooks.after_run, []),
        beforeRemove: this.readStringArray(hooks.before_remove, []),
        timeoutMs: hookTimeoutMs,
      },
    };
  }

  private asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  }

  private readString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Missing required config: ${field}`);
    }
    return value.trim();
  }

  private readPositiveInt(value: unknown, fallback: number): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      return fallback;
    }
    return value;
  }

  private readACPMode(value: unknown): ACPMode {
    if (value === "subprocess" || value === "mock") {
      return value;
    }
    return DEFAULT_ACP.mode;
  }

  private readStringOrFallback(value: unknown, fallback: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      return fallback;
    }
    return value.trim();
  }

  private readStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) return [...fallback];
    const strings = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    if (strings.length === 0) return [...fallback];
    return strings;
  }
}

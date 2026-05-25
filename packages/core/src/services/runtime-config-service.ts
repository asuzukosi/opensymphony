import type { RuntimeConfig, WorkflowDefinition } from "@core/types/workflow";

interface RuntimeConfigDefaults {
  pollIntervalMs: number;
  maxConcurrency: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  hookTimeoutMs: number;
}

const DEFAULTS: RuntimeConfigDefaults = {
  pollIntervalMs: 30_000,
  maxConcurrency: 3,
  retryBaseDelayMs: 10_000,
  retryMaxDelayMs: 300_000,
  hookTimeoutMs: 60_000,
};

const DEFAULT_RUNTIME_ADAPTER = {
  kind: "mock-acp" as const,
  completionDelayMs: 1200,
  acpCliCommand: process.execPath,
  acpCliArgs: ["-e", "setTimeout(() => process.exit(0), 1200)"],
};

export class RuntimeConfigService {
  toRuntimeConfig(definition: WorkflowDefinition): RuntimeConfig {
    const orchestrator = this.asObject(definition.config.orchestrator);
    const retry = this.asObject(definition.config.retry);
    const tracker = this.asObject(definition.config.tracker);
    const runtime = this.asObject(definition.config.runtime);
    const workspace = this.asObject(definition.config.workspace);
    const hooks = this.asObject(definition.config.hooks);

    const projectId = this.readString(tracker.project_id, "tracker.project_id");
    const trackerKind = this.readTrackerKind(tracker.kind);
    const pollIntervalMs = this.readPositiveInt(
      orchestrator.poll_interval_ms,
      DEFAULTS.pollIntervalMs,
    );
    const maxConcurrency = this.readPositiveInt(
      orchestrator.max_concurrency,
      DEFAULTS.maxConcurrency,
    );
    const retryBaseDelayMs = this.readPositiveInt(retry.base_delay_ms, DEFAULTS.retryBaseDelayMs);
    const retryMaxDelayMs = this.readPositiveInt(retry.max_delay_ms, DEFAULTS.retryMaxDelayMs);
    const activeStateCategories = ["active", "backlog"];
    const runtimeAdapterKind = this.readAdapterKind(runtime.adapter_kind);
    const runtimeAdapterDelayMs = this.readPositiveInt(
      runtime.mock_completion_delay_ms,
      DEFAULT_RUNTIME_ADAPTER.completionDelayMs,
    );
    const workspaceRoot = this.readStringOrFallback(workspace.root, ".symphony-workspaces");
    const hookTimeoutMs = this.readPositiveInt(hooks.timeout_ms, DEFAULTS.hookTimeoutMs);

    return {
      tracker: {
        kind: trackerKind,
        linearApiUrl: this.readStringOrFallback(
          tracker.linear_api_url,
          "https://api.linear.app/graphql",
        ),
        linearTokenEnvVar: this.readStringOrFallback(
          tracker.linear_token_env_var,
          "LINEAR_API_TOKEN",
        ),
        linearTeamId: this.readStringOrFallback(tracker.linear_team_id, "default"),
      },
      projectId,
      pollIntervalMs,
      maxConcurrency,
      retryBaseDelayMs,
      retryMaxDelayMs,
      activeStateCategories,
      runtimeAdapter: {
        kind: runtimeAdapterKind,
        completionDelayMs: runtimeAdapterDelayMs,
        acpCliCommand: this.readStringOrFallback(
          runtime.acp_cli_command,
          DEFAULT_RUNTIME_ADAPTER.acpCliCommand,
        ),
        acpCliArgs: this.readStringArray(runtime.acp_cli_args, DEFAULT_RUNTIME_ADAPTER.acpCliArgs),
      },
      workspaceRoot,
      hooks: {
        afterCreate: this.readStringArray(hooks.after_create, []),
        beforeAgentRun: this.readStringArray(
          hooks.before_agent_run,
          this.readStringArray(hooks.before_run, []),
        ),
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

  private readAdapterKind(value: unknown): "mock-acp" | "acp-cli" {
    if (value === "acp-cli") return "acp-cli";
    return DEFAULT_RUNTIME_ADAPTER.kind;
  }

  private readTrackerKind(value: unknown): "db" | "linear" {
    if (value === "linear") return "linear";
    return "db";
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

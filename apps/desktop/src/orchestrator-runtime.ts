import path from "node:path";
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { app } from "electron";
import {
  createTrackerStore,
  migrateUp,
  openDatabase,
  seedProjectWithDefaultStates,
  type ITrackerStore,
  type SqliteDatabase,
  type WorkflowStateCategory,
} from "@symphony/db";
import {
  createTrackerAdapter,
  OrchestratorService,
  RestartRecoveryService,
  RunLifecycleService,
  RuntimeConfigService,
  StructuredLoggerService,
  WorkflowLoaderService,
  WorkspaceManagerService,
  type RuntimeConfig,
  type TrackerAdapter,
} from "@symphony/core";
import type {
  IssueRunHistory,
  OrchestratorAuditEvent,
  OrchestratorIssueQueues,
  OrchestratorSnapshot,
  OrchestratorStatus,
} from "@/ipc";
import type { AgentRuntimeAdapter } from "@/runtime/agent-runtime-adapter";
import { createRuntimeAdapter } from "@/runtime/create-runtime-adapter";

interface RuntimeState {
  status: OrchestratorStatus;
  runtimeAdapterKind: "mock-acp" | "acp-cli";
  workflowPath: string;
  workflowVersion: string | null;
  workflowLastReloadedAt: string | null;
  startedAt: string | null;
  pollIntervalMs: number;
  pollIntervalSource: "workflow" | "override";
  nextTickAt: string | null;
  tickCount: number;
  lastTickAt: string | null;
  lastDispatchedCount: number;
  lastDeferredCount: number;
  lastCancelledCount: number;
  lastAction: string | null;
  lastError: string | null;
}

const state: RuntimeState = {
  status: "idle",
  runtimeAdapterKind: "mock-acp",
  workflowPath: "",
  workflowVersion: null,
  workflowLastReloadedAt: null,
  startedAt: null,
  pollIntervalMs: 30000,
  pollIntervalSource: "workflow",
  nextTickAt: null,
  tickCount: 0,
  lastTickAt: null,
  lastDispatchedCount: 0,
  lastDeferredCount: 0,
  lastCancelledCount: 0,
  lastAction: null,
  lastError: null,
};

let db: SqliteDatabase | null = null;
let store: ITrackerStore | null = null;
let orchestrator: OrchestratorService | null = null;
let runtimeAdapter: AgentRuntimeAdapter | null = null;
let loadedConfig: RuntimeConfig | null = null;
let loadedWorkflowVersion: string | null = null;
let workspaceManager: WorkspaceManagerService | null = null;
let trackerAdapter: TrackerAdapter | null = null;
const runAttemptWorkspacePath = new Map<string, string>();
const logger = new StructuredLoggerService();
let timer: ReturnType<typeof setInterval> | null = null;

interface RuntimeSettings {
  pollIntervalMs: number;
}

function runtimeSettingsPath(): string {
  return path.join(app.getPath("userData"), "runtime-settings.json");
}

function loadRuntimeSettings(): RuntimeSettings | null {
  const filePath = runtimeSettingsPath();
  if (!existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<RuntimeSettings>;
    if (!parsed || typeof parsed.pollIntervalMs !== "number" || parsed.pollIntervalMs < 1000)
      return null;
    return { pollIntervalMs: Math.floor(parsed.pollIntervalMs) };
  } catch {
    return null;
  }
}

function persistRuntimeSettings(settings: RuntimeSettings): void {
  writeFileSync(runtimeSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

function clearRuntimeSettings(): void {
  const filePath = runtimeSettingsPath();
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

function scheduleTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (state.status !== "running") {
    state.nextTickAt = null;
    return;
  }

  timer = setInterval(() => {
    runOrchestratorTick();
  }, state.pollIntervalMs);
  state.nextTickAt = new Date(Date.now() + state.pollIntervalMs).toISOString();
}

function ensureRuntimeConfig(applyPersisted = true): RuntimeConfig {
  const loader = new WorkflowLoaderService();
  const configService = new RuntimeConfigService();
  const workflowPath =
    process.env.SYMPHONY_WORKFLOW_PATH ?? path.join(process.cwd(), "WORKFLOW.md");

  try {
    const definition = loader.loadFromFile(workflowPath);
    const config = configService.toRuntimeConfig(definition);
    const persisted = applyPersisted ? loadRuntimeSettings() : null;
    if (persisted) {
      config.pollIntervalMs = persisted.pollIntervalMs;
      state.pollIntervalSource = "override";
    } else {
      state.pollIntervalSource = "workflow";
    }
    return config;
  } catch {
    const fallback: RuntimeConfig = {
      tracker: {
        kind: "db",
        linearApiUrl: "https://api.linear.app/graphql",
        linearTokenEnvVar: "LINEAR_API_TOKEN",
        linearTeamId: "default",
      },
      projectId: "desktop-default",
      pollIntervalMs: 30000,
      maxConcurrency: 2,
      retryBaseDelayMs: 10000,
      retryMaxDelayMs: 300000,
      activeStateCategories: ["active", "backlog"],
      runtimeAdapter: {
        kind: "mock-acp",
        completionDelayMs: 1200,
        acpCliCommand: process.execPath,
        acpCliArgs: ["-e", "setTimeout(() => process.exit(0), 1200)"],
      },
      workspaceRoot: ".symphony-workspaces",
      hooks: {
        afterCreate: [],
        beforeAgentRun: [],
        afterRun: [],
        beforeRemove: [],
        timeoutMs: 60_000,
      },
    };
    const persisted = applyPersisted ? loadRuntimeSettings() : null;
    if (persisted) {
      fallback.pollIntervalMs = persisted.pollIntervalMs;
      state.pollIntervalSource = "override";
    } else {
      state.pollIntervalSource = "workflow";
    }
    return fallback;
  }
}

function getWorkflowPath(): string {
  return process.env.SYMPHONY_WORKFLOW_PATH ?? path.join(process.cwd(), "WORKFLOW.md");
}

function computeWorkflowVersion(workflowPath: string): string | null {
  if (!existsSync(workflowPath)) return null;
  const stat = statSync(workflowPath);
  return `${stat.mtimeMs}:${stat.size}`;
}

function applyWorkflowConfig(
  config: RuntimeConfig,
  workflowPath: string,
  version: string | null,
): void {
  const previousPollIntervalMs = state.pollIntervalMs;
  loadedConfig = config;
  loadedWorkflowVersion = version;
  trackerAdapter = store ? createTrackerAdapter(store, config) : null;
  orchestrator = store ? new OrchestratorService(store, config, trackerAdapter ?? undefined) : null;
  runtimeAdapter = createRuntimeAdapter(config.runtimeAdapter);
  workspaceManager = new WorkspaceManagerService(
    path.resolve(process.cwd(), config.workspaceRoot),
    config.hooks,
  );
  state.runtimeAdapterKind = config.runtimeAdapter.kind;
  state.workflowPath = workflowPath;
  state.workflowVersion = version;
  state.workflowLastReloadedAt = new Date().toISOString();
  if (state.pollIntervalSource === "workflow") {
    state.pollIntervalMs = config.pollIntervalMs;
    if (state.status === "running" && previousPollIntervalMs !== state.pollIntervalMs) {
      scheduleTimer();
    }
  }
}

function ensureWorkspaceManager(config: RuntimeConfig): WorkspaceManagerService {
  if (!workspaceManager) {
    workspaceManager = new WorkspaceManagerService(
      path.resolve(process.cwd(), config.workspaceRoot),
      config.hooks,
    );
  }
  return workspaceManager;
}

function cleanupTerminalIssueWorkspaces(runtime: {
  config: RuntimeConfig;
  store: ITrackerStore;
}): void {
  const manager = ensureWorkspaceManager(runtime.config);
  const terminalIssues = runtime.store.issues.listIssuesByStateCategories(
    runtime.config.projectId,
    ["terminal" as WorkflowStateCategory],
  );
  for (const issue of terminalIssues) {
    logger.info({
      event: "workspace_cleanup_startup",
      message: "Removing terminal workspace during startup cleanup",
      projectId: runtime.config.projectId,
      issueId: issue.id,
      issueIdentifier: issue.identifier,
    });
    manager.removeWorkspace(issue.identifier);
  }
}

function ensureDbAndOrchestrator(): {
  orchestrator: OrchestratorService;
  config: RuntimeConfig;
  store: ITrackerStore;
} {
  const workflowPath = getWorkflowPath();
  const workflowVersion = computeWorkflowVersion(workflowPath);
  const hasWorkflowChanged = loadedWorkflowVersion !== workflowVersion;
  if (!loadedConfig || hasWorkflowChanged) {
    const config = ensureRuntimeConfig();
    applyWorkflowConfig(config, workflowPath, workflowVersion);
  }

  const config = loadedConfig ?? ensureRuntimeConfig();
  if (!db) {
    const userData = app.getPath("userData");
    const dbPath = path.join(userData, "symphony.sqlite");
    db = openDatabase(dbPath);
    migrateUp(db);
    seedProjectWithDefaultStates(db, {
      id: config.projectId,
      name: "Symphony Desktop",
      slug: "symphony-desktop",
    });
  }

  if (!store) {
    store = createTrackerStore(db);
    if (loadedConfig) {
      trackerAdapter = createTrackerAdapter(store, loadedConfig);
      orchestrator = new OrchestratorService(store, loadedConfig, trackerAdapter);
    }
  }

  if (!orchestrator) {
    trackerAdapter = trackerAdapter ?? createTrackerAdapter(store, config);
    orchestrator = new OrchestratorService(store, config, trackerAdapter);
  }
  if (!runtimeAdapter) {
    runtimeAdapter = createRuntimeAdapter(config.runtimeAdapter);
    state.runtimeAdapterKind = config.runtimeAdapter.kind;
  }

  return { orchestrator, config, store };
}

function recoverStaleRuns(runtime: { config: RuntimeConfig; store: ITrackerStore }): void {
  const recovery = new RestartRecoveryService(
    runtime.store.runAttempts,
    runtime.store.agentSessions,
    runtime.store.retryQueue,
  );
  const result = recovery.recoverStaleRuns({
    projectId: runtime.config.projectId,
    retryBaseDelayMs: runtime.config.retryBaseDelayMs,
    retryMaxDelayMs: runtime.config.retryMaxDelayMs,
  });
  if (result.recoveredAttempts > 0 || result.recoveredSessions > 0) {
    logger.warn({
      event: "restart_recovery_applied",
      message: "Recovered stale running attempts/sessions from previous runtime process",
      projectId: runtime.config.projectId,
      meta: { ...result },
    });
  }
}

export function startOrchestratorRuntime(): void {
  if (timer) return;

  const runtime = ensureDbAndOrchestrator();
  recoverStaleRuns(runtime);
  cleanupTerminalIssueWorkspaces(runtime);
  const { config } = runtime;
  state.status = "running";
  state.startedAt = state.startedAt ?? new Date().toISOString();
  state.pollIntervalMs = config.pollIntervalMs;
  state.lastAction = "runtime_started";
  state.lastError = null;
  logger.info({
    event: "runtime_started",
    message: "Orchestrator runtime started",
    projectId: config.projectId,
    runtimeKind: state.runtimeAdapterKind,
  });
  scheduleTimer();
}

export function stopOrchestratorRuntime(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  state.status = "stopped";
  state.nextTickAt = null;
  state.lastAction = "runtime_stopped";
  logger.info({
    event: "runtime_stopped",
    message: "Orchestrator runtime stopped",
  });
}

export function runOrchestratorTick(nowIso: string = new Date().toISOString()): void {
  try {
    const runtime = ensureDbAndOrchestrator();
    if (!runtimeAdapter) {
      runtimeAdapter = createRuntimeAdapter(runtime.config.runtimeAdapter);
    }
    const pollResult = runtime.orchestrator.runPollCycle(nowIso);
    const runLifecycle = new RunLifecycleService(
      runtime.store.runAttempts,
      runtime.store.agentSessions,
    );
    const manager = ensureWorkspaceManager(runtime.config);

    for (const dispatched of pollResult.dispatched) {
      const workspace = manager.ensureWorkspace(dispatched.identifier);
      if (workspace.createdNow) {
        manager.runAfterCreate(workspace.workspacePath);
      }
      manager.runBeforeAgentRun(workspace.workspacePath);
      runAttemptWorkspacePath.set(dispatched.runAttemptId, workspace.workspacePath);

      const startedSession = runtimeAdapter.startSession({
        runAttemptId: dispatched.runAttemptId,
        issueId: dispatched.issueId,
        attemptNumber: dispatched.attemptNumber,
        startedAt: nowIso,
      });
      runLifecycle.attachSession({
        sessionId: startedSession.sessionId,
        runAttemptId: dispatched.runAttemptId,
        runtimeKind: startedSession.runtimeKind,
        sessionRef: startedSession.sessionRef ?? undefined,
      });
      logger.info({
        event: "attempt_dispatched",
        message: "Dispatched run attempt and attached runtime session",
        projectId: runtime.config.projectId,
        issueId: dispatched.issueId,
        issueIdentifier: dispatched.identifier,
        runAttemptId: dispatched.runAttemptId,
        sessionId: startedSession.sessionId,
        runtimeKind: startedSession.runtimeKind,
      });
    }

    const reconciliation = runtime.orchestrator.reconcileRunningAttempts();
    const cancelledByRunAttemptId = new Set(
      reconciliation.filter((item) => item.action === "cancelled").map((item) => item.runAttemptId),
    );

    const runningAttempts = runtime.store.runAttempts.listRunningRunAttempts(
      runtime.config.projectId,
    );
    const runningSessions = runningAttempts.flatMap((attempt) =>
      runtime.store.agentSessions
        .listSessionsByRunAttempt(attempt.id)
        .filter((session) => session.status === "running")
        .map((session) => ({ session, attempt })),
    );

    for (const { session } of runningSessions) {
      if (cancelledByRunAttemptId.has(session.runAttemptId)) {
        runtimeAdapter.cancelSession(session.id, nowIso);
        runLifecycle.finishSession(session.id, "cancelled");
        runAttemptWorkspacePath.delete(session.runAttemptId);
        logger.warn({
          event: "session_cancelled",
          message: "Cancelled running session during reconciliation",
          projectId: runtime.config.projectId,
          issueId: session.runAttemptId.split(":attempt:")[0] ?? undefined,
          runAttemptId: session.runAttemptId,
          sessionId: session.id,
          runtimeKind: session.runtimeKind,
        });
      }
    }

    for (const item of reconciliation) {
      if (item.action === "cancelled" && item.reason === "terminal") {
        const issue = runtime.store.issues.getIssueById(item.issueId);
        if (issue) {
          manager.removeWorkspace(issue.identifier);
          logger.info({
            event: "workspace_cleanup_terminal_transition",
            message: "Removed workspace after issue reached terminal state",
            projectId: runtime.config.projectId,
            issueId: issue.id,
            issueIdentifier: issue.identifier,
            runAttemptId: item.runAttemptId,
          });
        }
      }
    }

    const polledStatuses = runtimeAdapter.pollSessions(
      nowIso,
      runningSessions.map(({ session }) => session.id),
    );

    for (const status of polledStatuses) {
      if (status.status === "running") continue;
      const matchingAttempt = runningAttempts.find((attempt) => attempt.id === status.runAttemptId);
      if (!matchingAttempt) continue;

      if (status.status === "succeeded") {
        runLifecycle.finishSession(status.sessionId, "succeeded");
        runLifecycle.finishRun(status.runAttemptId, "succeeded");
        runtime.store.retryQueue.removeRetry(status.issueId);
        const workspacePath = runAttemptWorkspacePath.get(status.runAttemptId);
        if (workspacePath) {
          manager.runAfterRun(workspacePath);
          runAttemptWorkspacePath.delete(status.runAttemptId);
        }
        logger.info({
          event: "attempt_succeeded",
          message: "Run attempt succeeded",
          projectId: runtime.config.projectId,
          issueId: status.issueId,
          runAttemptId: status.runAttemptId,
          sessionId: status.sessionId,
          runtimeKind: status.runtimeKind,
        });
      } else if (status.status === "failed") {
        runLifecycle.finishSession(status.sessionId, "failed");
        runtime.orchestrator.markAttemptFailed(
          status.runAttemptId,
          status.issueId,
          matchingAttempt.attemptNumber,
          status.errorMessage ?? "runtime_failure",
        );
        const workspacePath = runAttemptWorkspacePath.get(status.runAttemptId);
        if (workspacePath) {
          manager.runAfterRun(workspacePath);
          runAttemptWorkspacePath.delete(status.runAttemptId);
        }
        logger.error({
          event: "attempt_failed",
          message: "Run attempt failed and retry scheduled",
          projectId: runtime.config.projectId,
          issueId: status.issueId,
          runAttemptId: status.runAttemptId,
          sessionId: status.sessionId,
          runtimeKind: status.runtimeKind,
          error: status.errorMessage ?? "runtime_failure",
        });
      } else if (status.status === "cancelled") {
        runLifecycle.finishSession(status.sessionId, "cancelled");
        const workspacePath = runAttemptWorkspacePath.get(status.runAttemptId);
        if (workspacePath) {
          manager.runAfterRun(workspacePath);
          runAttemptWorkspacePath.delete(status.runAttemptId);
        }
        logger.warn({
          event: "attempt_cancelled",
          message: "Run attempt cancelled",
          projectId: runtime.config.projectId,
          issueId: status.issueId,
          runAttemptId: status.runAttemptId,
          sessionId: status.sessionId,
          runtimeKind: status.runtimeKind,
        });
      }
    }

    state.tickCount += 1;
    state.lastTickAt = nowIso;
    state.lastDispatchedCount = pollResult.dispatched.length;
    state.lastDeferredCount = pollResult.deferred.length;
    state.lastCancelledCount = reconciliation.filter(
      (item: { action: "cancelled" | "kept" }) => item.action === "cancelled",
    ).length;
    state.status = "running";
    state.nextTickAt = timer ? new Date(Date.now() + state.pollIntervalMs).toISOString() : null;
    state.lastAction = "tick_completed";
    state.lastError = null;
    logger.info({
      event: "tick_completed",
      message: "Orchestrator tick completed",
      projectId: runtime.config.projectId,
      meta: {
        dispatched: pollResult.dispatched.length,
        deferred: pollResult.deferred.length,
        cancelled: state.lastCancelledCount,
      },
    });
  } catch (error) {
    state.lastAction = "tick_failed";
    state.lastError = error instanceof Error ? error.message : "Unknown runtime tick error";
    logger.error({
      event: "tick_failed",
      message: "Orchestrator tick failed",
      error: state.lastError,
    });
  }
}

export function setOrchestratorPollIntervalMs(pollIntervalMs: number): void {
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 1000) {
    throw new Error("pollIntervalMs must be at least 1000 ms");
  }

  state.pollIntervalMs = Math.floor(pollIntervalMs);
  state.pollIntervalSource = "override";
  persistRuntimeSettings({ pollIntervalMs: state.pollIntervalMs });
  if (state.status === "running") {
    scheduleTimer();
  }
  state.lastAction = "poll_interval_updated";
  state.lastError = null;
}

export function clearOrchestratorPollIntervalOverride(): void {
  clearRuntimeSettings();
  const workflowConfig = ensureRuntimeConfig(false);
  state.pollIntervalMs = workflowConfig.pollIntervalMs;
  state.pollIntervalSource = "workflow";
  if (state.status === "running") {
    scheduleTimer();
  }
  state.lastAction = "poll_interval_reset_to_workflow";
  state.lastError = null;
}

export function getOrchestratorSnapshot(): OrchestratorSnapshot {
  return { ...state };
}

export function getOrchestratorStatus(): OrchestratorStatus {
  return state.status;
}

export function getOrchestratorIssueQueues(): OrchestratorIssueQueues {
  const runtime = ensureDbAndOrchestrator();
  trackerAdapter = trackerAdapter ?? createTrackerAdapter(runtime.store, runtime.config);
  const running = runtime.store.runAttempts.listRunningRunAttempts(runtime.config.projectId);
  const retries = runtime.store.retryQueue.listRetries();
  const candidates = trackerAdapter
    .listCandidateIssues(runtime.config.projectId, runtime.config.activeStateCategories)
    .map((item) => ({
      issueId: item.id,
      identifier: item.identifier,
      title: item.title,
      priority: item.priority,
      stateCategory: item.stateCategory,
    }));

  return {
    running: running.map((attempt) => ({
      runAttemptId: attempt.id,
      issueId: attempt.issueId,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
    })),
    retryQueue: retries.map((entry) => ({
      issueId: entry.issueId,
      attemptNumber: entry.attemptNumber,
      dueAt: entry.dueAt,
      errorMessage: entry.errorMessage,
    })),
    candidates,
  };
}

export function getRecentAuditEvents(limit = 20): OrchestratorAuditEvent[] {
  const runtime = ensureDbAndOrchestrator();
  const cap = Math.max(1, Math.min(200, Math.floor(limit)));
  return runtime.store.audits.listAuditEvents(runtime.config.projectId).slice(0, cap);
}

export function getIssueRunHistory(issueId: string, limit = 20): IssueRunHistory {
  const runtime = ensureDbAndOrchestrator();
  const attempts = runtime.store.runAttempts.listRunAttemptsByIssue(issueId, limit);
  return {
    issueId,
    attempts: attempts.map((attempt) => ({
      runAttemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      errorMessage: attempt.errorMessage,
      sessions: runtime.store.agentSessions.listSessionsByRunAttempt(attempt.id).map((session) => ({
        sessionId: session.id,
        runtimeKind: session.runtimeKind,
        sessionRef: session.sessionRef,
        status: session.status,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
      })),
    })),
  };
}

export function transitionIssue(issueId: string, targetStateId: string, actor?: string): void {
  const runtime = ensureDbAndOrchestrator();
  trackerAdapter = trackerAdapter ?? createTrackerAdapter(runtime.store, runtime.config);
  trackerAdapter.transitionIssue(issueId, targetStateId, actor);
  logger.info({
    event: "issue_transitioned",
    message: "Issue transitioned via orchestrator tracker API",
    projectId: runtime.config.projectId,
    issueId,
    meta: { targetStateId, actor: actor ?? null },
  });
}

export function addIssueComment(issueId: string, body: string, authorId?: string): void {
  const runtime = ensureDbAndOrchestrator();
  trackerAdapter = trackerAdapter ?? createTrackerAdapter(runtime.store, runtime.config);
  trackerAdapter.addIssueComment(issueId, body, authorId ?? undefined);
  logger.info({
    event: "issue_comment_added",
    message: "Issue comment added via orchestrator tracker API",
    projectId: runtime.config.projectId,
    issueId,
    meta: { authorId: authorId ?? null },
  });
}

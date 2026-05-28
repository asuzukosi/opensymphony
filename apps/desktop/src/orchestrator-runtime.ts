import path from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import {
  createTrackerStore,
  migrateUp,
  openDatabase,
  type ITrackerStore,
  type IssueDetailRow,
  type SqliteDatabase,
  type WorkflowStateCategory,
} from "@symphony/db";
import {
  CandidateSelectionService,
  DEFAULT_RETRY_BASE_DELAY_MS,
  OrchestratorService,
  RestartRecoveryService,
  RunLifecycleService,
  RuntimeConfigService,
  StructuredLoggerService,
  TrackerService,
  WorkspaceManagerService,
  type LoadedWorkflow,
  type PermissionMode,
  type RuntimeConfig,
} from "@symphony/core";
import type {
  ControlRuntimeRequest,
  IssueDetail,
  MutateIssueRequest,
  PendingPermission,
  ProjectBoard,
  ResolvePermissionRequest,
  RuntimeAuditEvent,
  RuntimeCandidateEntry,
  RuntimeStateSnapshot,
  RuntimeStatus,
  SettingsView,
} from "@/ipc";
import type { ACPAdapter } from "@/runtime/acp";
import { createACPAdapter, type CreateACPAdapterDependencies } from "@/runtime/acp";
import {
  createPermissionRouter,
  type PermissionRouter,
} from "@/runtime/acp/permission-router";
import {
  createPermissionStore,
  type PendingPermission as StorePendingPermission,
  type PermissionStore,
} from "@/runtime/acp/permission-store";
import { resolveWorkflowPath } from "@/runtime/workflow-path";
import { buildProjectSeedInput, ensureProjectSeededOnce } from "@/runtime/project-seed";
import { buildRuntimeSnapshot } from "@/runtime/runtime-snapshot";

interface RuntimeState {
  status: RuntimeStatus;
  workflowPath: string;
  workflowVersion: string | null;
  workflowLastReloadedAt: string | null;
  startedAt: string | null;
  pollIntervalMs: number;
  pollIntervalSource: "workflow" | "override";
  permissionMode: PermissionMode;
  permissionModeSource: "workflow" | "override";
  nextTickAt: string | null;
  tickCount: number;
  lastTickAt: string | null;
  lastDispatchedCount: number;
  lastDeferredCount: number;
  lastCancelledCount: number;
  lastAction: string | null;
  lastError: string | null;
}

const defaultDemoAcpServerPath = fileURLToPath(
  new URL("../../../scripts/demo-acp-server.mjs", import.meta.url),
);

const state: RuntimeState = {
  status: "idle",
  workflowPath: "",
  workflowVersion: null,
  workflowLastReloadedAt: null,
  startedAt: null,
  pollIntervalMs: 3000,
  pollIntervalSource: "workflow",
  permissionMode: "auto_approve",
  permissionModeSource: "workflow",
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
let runtimeAdapter: ACPAdapter | null = null;
let loadedConfig: RuntimeConfig | null = null;
let loadedPromptTemplate = "";
let loadedWorkflowVersion: string | null = null;
let workspaceManager: WorkspaceManagerService | null = null;
const runAttemptWorkspacePath = new Map<string, string>();
const seededProjectIds = new Set<string>();
const logger = new StructuredLoggerService();
let permissionStore: PermissionStore | null = null;
let permissionRouter: PermissionRouter | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function ensurePermissionStore(): PermissionStore {
  permissionStore ??= createPermissionStore();
  return permissionStore;
}

export function getPermissionStore(): PermissionStore {
  return ensurePermissionStore();
}

function toPendingPermissionView(entry: StorePendingPermission): PendingPermission {
  return {
    id: entry.id,
    sessionId: entry.sessionId,
    issueId: entry.issueId,
    summary: entry.summary,
    payload: entry.payload,
    createdAt: entry.createdAt,
  };
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

function fallbackRuntimeConfig(): RuntimeConfig {
  return {
    projectId: "desktop-default",
    pollIntervalMs: 3000,
    maxConcurrency: 2,
    retryMaxBackoffMs: 300000,
    workspaceRoot: ".symphony-workspaces",
    acp: {
      command: process.execPath,
      args: [defaultDemoAcpServerPath],
      permissionMode: "auto_approve",
    },
    hooks: {
      afterCreate: [],
      beforeAgentRun: [],
      afterRun: [],
      beforeRemove: [],
      timeoutMs: 60_000,
    },
  };
}

function loadWorkflow(): LoadedWorkflow {
  const configService = new RuntimeConfigService();
  const workflowPath = resolveWorkflowPath();

  try {
    return configService.loadWorkflowFromFile(workflowPath);
  } catch {
    return {
      config: fallbackRuntimeConfig(),
      promptTemplate: "",
    };
  }
}

function ensureRuntimeConfig(): RuntimeConfig {
  return loadWorkflow().config;
}

function getWorkflowPath(): string {
  return resolveWorkflowPath();
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
  orchestrator = store ? new OrchestratorService(store, config) : null;
  runtimeAdapter = createACPAdapter(config.acp, createACPAdapterDeps());
  workspaceManager = new WorkspaceManagerService(
    path.resolve(process.cwd(), config.workspaceRoot),
    config.hooks,
  );
  state.workflowPath = workflowPath;
  state.workflowVersion = version;
  state.workflowLastReloadedAt = new Date().toISOString();
  if (state.pollIntervalSource === "workflow") {
    state.pollIntervalMs = config.pollIntervalMs;
    if (state.status === "running" && previousPollIntervalMs !== state.pollIntervalMs) {
      scheduleTimer();
    }
  }
  if (state.permissionModeSource === "workflow") {
    state.permissionMode = config.acp.permissionMode;
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
    const loaded = loadWorkflow();
    applyWorkflowConfig(loaded.config, workflowPath, workflowVersion);
    loadedPromptTemplate = loaded.promptTemplate;
  }

  const config = loadedConfig ?? ensureRuntimeConfig();
  if (!db) {
    const userData = app.getPath("userData");
    const dbPath = path.join(userData, "symphony.sqlite");
    db = openDatabase(dbPath);
    migrateUp(db);
  }

  ensureProjectSeededOnce(db, config.projectId, seededProjectIds);

  if (!store) {
    store = createTrackerStore(db);
    if (loadedConfig) {
      orchestrator = new OrchestratorService(store, loadedConfig);
    }
  }

  if (!orchestrator) {
    orchestrator = new OrchestratorService(store, config);
  }
  if (!runtimeAdapter) {
    runtimeAdapter = createACPAdapter(config.acp, createACPAdapterDeps());
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
    retryBaseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs: runtime.config.retryMaxBackoffMs,
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
  state.permissionMode = config.acp.permissionMode;
  state.lastAction = "runtime_started";
  state.lastError = null;
  logger.info({
    event: "runtime_started",
    message: "Orchestrator runtime started",
    projectId: config.projectId,
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
      runtimeAdapter = createACPAdapter(runtime.config.acp, createACPAdapterDeps());
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

      const issue = runtime.store.issues.getIssueById(dispatched.issueId);
      const startedSession = runtimeAdapter.startSession({
        runAttemptId: dispatched.runAttemptId,
        issueId: dispatched.issueId,
        identifier: dispatched.identifier,
        title: issue?.title ?? dispatched.identifier,
        description: issue?.description ?? null,
        promptTemplate: loadedPromptTemplate,
        attemptNumber: dispatched.attemptNumber,
        startedAt: nowIso,
        workspacePath: workspace.workspacePath,
      });
      runLifecycle.attachSession({
        sessionId: startedSession.sessionId,
        runAttemptId: dispatched.runAttemptId,
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
        runLifecycle.finishRun(session.runAttemptId, "cancelled", "cancelled_by_reconciliation");
        runAttemptWorkspacePath.delete(session.runAttemptId);
        logger.warn({
          event: "session_cancelled",
          message: "Cancelled running session during reconciliation",
          projectId: runtime.config.projectId,
          issueId: session.runAttemptId.split(":attempt:")[0] ?? undefined,
          runAttemptId: session.runAttemptId,
          sessionId: session.id,
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
      if (status.sessionRef) {
        runLifecycle.syncSessionRef(status.sessionId, status.sessionRef);
      }

      if (status.status === "running") continue;
      const matchingAttempt = runningAttempts.find((attempt) => attempt.id === status.runAttemptId);
      if (!matchingAttempt) continue;

      if (status.status === "succeeded") {
        const finalAgentMessage = runtimeAdapter.getLastAgentMessage(status.sessionId);
        runLifecycle.finishSession(status.sessionId, "succeeded");
        runLifecycle.finishRun(status.runAttemptId, "succeeded");
        runtime.orchestrator.markAttemptSucceeded(status.issueId);
        if (finalAgentMessage) {
          const tracker = new TrackerService(runtime.store);
          tracker.addComment({
            id: randomUUID(),
            issueId: status.issueId,
            body: finalAgentMessage,
            authorId: "symphony-agent",
            actor: "symphony-agent",
          });
        }
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
          error: status.errorMessage ?? "runtime_failure",
        });
      } else if (status.status === "cancelled") {
        runLifecycle.finishSession(status.sessionId, "cancelled");
        runLifecycle.finishRun(
          status.runAttemptId,
          "cancelled",
          status.errorMessage ?? "cancelled_by_reconciliation",
        );
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
  if (state.status === "running") {
    scheduleTimer();
  }
  state.lastAction = "poll_interval_updated";
  state.lastError = null;
}

export function clearOrchestratorPollIntervalOverride(): void {
  const workflowConfig = ensureRuntimeConfig();
  state.pollIntervalMs = workflowConfig.pollIntervalMs;
  state.pollIntervalSource = "workflow";
  if (state.status === "running") {
    scheduleTimer();
  }
  state.lastAction = "poll_interval_reset_to_workflow";
  state.lastError = null;
}

export function getOrchestratorPermissionMode(): PermissionMode {
  return state.permissionMode;
}

export function getPermissionRouter(): PermissionRouter {
  permissionRouter ??= createPermissionRouter({
    store: ensurePermissionStore(),
    getPermissionMode: getOrchestratorPermissionMode,
  });
  return permissionRouter;
}

function createACPAdapterDeps(): CreateACPAdapterDependencies {
  return {
    getPermissionRouter,
    appendSessionEvent: (input) => {
      store?.sessionEvents.append(input);
    },
  };
}

export function setOrchestratorPermissionMode(permissionMode: PermissionMode): void {
  if (permissionMode !== "auto_approve" && permissionMode !== "requires_approval") {
    throw new Error("permissionMode must be auto_approve or requires_approval");
  }

  state.permissionMode = permissionMode;
  state.permissionModeSource = "override";
  state.lastAction = "permission_mode_updated";
  state.lastError = null;
}

export function clearOrchestratorPermissionModeOverride(): void {
  const workflowConfig = ensureRuntimeConfig();
  state.permissionMode = workflowConfig.acp.permissionMode;
  state.permissionModeSource = "workflow";
  state.lastAction = "permission_mode_reset_to_workflow";
  state.lastError = null;
}

export function getPendingPermissions(): PendingPermission[] {
  if (getOrchestratorPermissionMode() === "auto_approve") {
    return [];
  }

  return ensurePermissionStore().listPending().map(toPendingPermissionView);
}

export function resolvePermission(request: ResolvePermissionRequest): void {
  if (getOrchestratorPermissionMode() === "auto_approve") {
    throw new Error("resolvePermission is unavailable when permission mode is auto_approve");
  }

  const resolved = ensurePermissionStore().resolve(request.id, request.decision);
  if (!resolved) {
    throw new Error(`pending permission not found: ${request.id}`);
  }
}

function ensureRuntimeAdapter(): ACPAdapter {
  const runtime = ensureDbAndOrchestrator();
  if (!runtimeAdapter) {
    runtimeAdapter = createACPAdapter(runtime.config.acp, createACPAdapterDeps());
  }
  return runtimeAdapter;
}

function getRunningSessionForRunAttempt(
  store: ReturnType<typeof ensureDbAndOrchestrator>["store"],
  runAttemptId: string,
) {
  return (
    store.agentSessions
      .listSessionsByRunAttempt(runAttemptId)
      .find((session) => session.status === "running") ?? null
  );
}

export function pauseRunAttempt(runAttemptId: string): void {
  const runtime = ensureDbAndOrchestrator();
  const adapter = ensureRuntimeAdapter();
  const session = getRunningSessionForRunAttempt(runtime.store, runAttemptId);
  if (!session) {
    throw new Error(`no running session for run attempt: ${runAttemptId}`);
  }

  adapter.pauseSession(session.id);
  state.lastAction = "run_paused";
  state.lastError = null;
}

export function resumeRunAttempt(runAttemptId: string): void {
  const runtime = ensureDbAndOrchestrator();
  const adapter = ensureRuntimeAdapter();
  const session = getRunningSessionForRunAttempt(runtime.store, runAttemptId);
  if (!session) {
    throw new Error(`no running session for run attempt: ${runAttemptId}`);
  }

  adapter.resumeSession(session.id);
  state.lastAction = "run_resumed";
  state.lastError = null;
}

export function cancelRunAttempt(
  runAttemptId: string,
  nowIso: string = new Date().toISOString(),
): void {
  const runtime = ensureDbAndOrchestrator();
  const adapter = ensureRuntimeAdapter();
  const manager = ensureWorkspaceManager(runtime.config);
  const runLifecycle = new RunLifecycleService(
    runtime.store.runAttempts,
    runtime.store.agentSessions,
  );

  const attempt = runtime.store.runAttempts
    .listRunningRunAttempts(runtime.config.projectId)
    .find((entry) => entry.id === runAttemptId);
  if (!attempt) {
    throw new Error(`run attempt is not running: ${runAttemptId}`);
  }

  const sessions = runtime.store.agentSessions
    .listSessionsByRunAttempt(runAttemptId)
    .filter((session) => session.status === "running");

  for (const session of sessions) {
    adapter.cancelSession(session.id, nowIso, "cancelled_by_operator");
    runLifecycle.finishSession(session.id, "cancelled");
  }

  runLifecycle.finishRun(runAttemptId, "cancelled", "cancelled_by_operator");

  const workspacePath = runAttemptWorkspacePath.get(runAttemptId);
  if (workspacePath) {
    manager.runAfterRun(workspacePath);
    runAttemptWorkspacePath.delete(runAttemptId);
  }

  logger.warn({
    event: "run_cancelled_by_operator",
    message: "Run attempt cancelled by operator",
    projectId: runtime.config.projectId,
    issueId: attempt.issueId,
    runAttemptId,
  });

  state.lastAction = "run_cancelled";
  state.lastError = null;
}

export function getRuntimeState(eventLimit = 20): RuntimeStateSnapshot {
  const runtime = ensureDbAndOrchestrator();
  const candidateSelection = new CandidateSelectionService(
    runtime.store.issues,
    runtime.store.dependencies,
    runtime.store.workflowStates,
    runtime.store.runAttempts,
  );
  const candidates: RuntimeCandidateEntry[] = candidateSelection
    .listEligible(runtime.config.projectId)
    .map((item) => ({
      issueId: item.issueId,
      identifier: item.identifier,
      title: item.title,
      priority: item.priority,
      stateCategory: item.stateCategory,
    }));

  const cap = Math.max(0, Math.min(200, Math.floor(eventLimit)));
  const recentEvents: RuntimeAuditEvent[] =
    cap === 0
      ? []
      : runtime.store.audits.listAuditEvents(runtime.config.projectId).slice(0, cap);

  return buildRuntimeSnapshot({
    store: runtime.store,
    projectId: runtime.config.projectId,
    sessionObservability: runtimeAdapter,
    state: {
      status: state.status,
      workflowPath: state.workflowPath,
      workflowVersion: state.workflowVersion,
      workflowLastReloadedAt: state.workflowLastReloadedAt,
      startedAt: state.startedAt,
      pollIntervalMs: state.pollIntervalMs,
      pollIntervalSource: state.pollIntervalSource,
      nextTickAt: state.nextTickAt,
      tickCount: state.tickCount,
      lastTickAt: state.lastTickAt,
      lastDispatchedCount: state.lastDispatchedCount,
      lastDeferredCount: state.lastDeferredCount,
      lastCancelledCount: state.lastCancelledCount,
      lastAction: state.lastAction,
      lastError: state.lastError,
    },
    candidates,
    recentEvents,
  });
}

export function getSettings(): SettingsView {
  const { config, store } = ensureDbAndOrchestrator();
  const projectRow = store.projects.getProject(config.projectId);
  const projectSeed = buildProjectSeedInput(config.projectId);

  return {
    status: state.status,
    workflowPath: state.workflowPath,
    workflowVersion: state.workflowVersion,
    promptTemplate: loadedPromptTemplate,
    pollIntervalMs: state.pollIntervalMs,
    pollIntervalSource: state.pollIntervalSource,
    permissionMode: state.permissionMode,
    permissionModeSource: state.permissionModeSource,
    project: projectRow
      ? { id: projectRow.id, name: projectRow.name, slug: projectRow.slug }
      : { id: projectSeed.id, name: projectSeed.name, slug: projectSeed.slug },
    acp: {
      command: config.acp.command,
      args: [...config.acp.args],
    },
    startedAt: state.startedAt,
    nextTickAt: state.nextTickAt,
    tickCount: state.tickCount,
    lastTickAt: state.lastTickAt,
    lastAction: state.lastAction,
    lastError: state.lastError,
  };
}

export function getProjectBoard(): ProjectBoard {
  const runtime = ensureDbAndOrchestrator();

  return {
    columns: runtime.store.issues
      .listIssuesGroupedByWorkflowState(runtime.config.projectId)
      .map((column) => ({
        stateId: column.workflowStateId,
        stateName: column.workflowStateName,
        category: column.category,
        issues: column.issues.map((issue) => ({
          issueId: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          priority: issue.priority,
        })),
      })),
  };
}

function parseSessionEventPayload(payloadJson: string): unknown {
  try {
    return JSON.parse(payloadJson) as unknown;
  } catch {
    return payloadJson;
  }
}

function mapIssueDetailForIpc(detail: IssueDetailRow): IssueDetail {
  return {
    issueId: detail.issueId,
    projectId: detail.projectId,
    identifier: detail.identifier,
    title: detail.title,
    description: detail.description,
    priority: detail.priority,
    workflowStateId: detail.workflowStateId,
    workflowStateName: detail.workflowStateName,
    comments: detail.comments,
    attempts: detail.attempts.map((attempt) => ({
      runAttemptId: attempt.runAttemptId,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      errorMessage: attempt.errorMessage,
      sessions: attempt.sessions.map((session) => ({
        sessionId: session.sessionId,
        sessionRef: session.sessionRef,
        status: session.status,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        events: session.events.map((event) => ({
          id: event.id,
          kind: event.kind,
          payload: parseSessionEventPayload(event.payloadJson),
          createdAt: event.createdAt,
        })),
      })),
    })),
  };
}

export function getIssue(issueId: string, attemptLimit = 20): IssueDetail {
  const runtime = ensureDbAndOrchestrator();
  const detail = runtime.store.issues.getIssueDetail(issueId, attemptLimit);
  if (!detail) {
    throw new Error(`issue not found: ${issueId}`);
  }

  return mapIssueDetailForIpc(detail);
}

function nextIssueIdentifier(store: ITrackerStore, projectId: string): string {
  const project = store.projects.getProject(projectId);
  if (!project) {
    throw new Error(`project not found: ${projectId}`);
  }

  const issueCount = store.issues.listIssuesByStateCategories(projectId, [
    "active",
    "backlog",
    "terminal",
    "other",
  ]).length;
  const prefix = project.slug.toUpperCase().replace(/[^A-Z0-9]/g, "") || "ISSUE";

  return `${prefix}-${issueCount + 1}`;
}

function isTodoWorkflowState(state: {
  id: string;
  name: string;
  category: WorkflowStateCategory;
}): boolean {
  if (state.id.endsWith(":todo")) {
    return true;
  }

  const normalizedName = state.name.trim().toLowerCase();
  if (normalizedName === "todo" || normalizedName === "to do") {
    return true;
  }

  return state.category === "backlog";
}

export function mutateIssue(request: MutateIssueRequest): void {
  switch (request.action) {
    case "transition": {
      const runtime = ensureDbAndOrchestrator();
      const tracker = new TrackerService(runtime.store);
      tracker.transitionIssue(request.issueId, request.targetStateId, request.actor);
      logger.info({
        event: "issue_transitioned",
        message: "issue transitioned via tracker service",
        projectId: runtime.config.projectId,
        issueId: request.issueId,
        meta: { targetStateId: request.targetStateId, actor: request.actor ?? null },
      });
      return;
    }
    case "comment": {
      const runtime = ensureDbAndOrchestrator();
      const tracker = new TrackerService(runtime.store);
      tracker.addComment({
        id: randomUUID(),
        issueId: request.issueId,
        body: request.body,
        authorId: request.authorId,
        actor: request.authorId,
      });
      logger.info({
        event: "issue_comment_added",
        message: "issue comment added via tracker service",
        projectId: runtime.config.projectId,
        issueId: request.issueId,
        meta: { authorId: request.authorId ?? null },
      });
      return;
    }
    case "create": {
      const runtime = ensureDbAndOrchestrator();
      if (request.projectId !== runtime.config.projectId) {
        throw new Error(`project mismatch: ${request.projectId}`);
      }

      const title = request.title.trim();
      if (!title) {
        throw new Error("title is required");
      }

      const tracker = new TrackerService(runtime.store);
      const issue = tracker.createIssue({
        id: randomUUID(),
        projectId: request.projectId,
        identifier: nextIssueIdentifier(runtime.store, request.projectId),
        title,
        description: request.description,
        priority: request.priority,
      });

      if (request.workflowStateId && request.workflowStateId !== issue.workflowStateId) {
        const targetState = runtime.store.workflowStates.getWorkflowStateById(
          request.workflowStateId,
        );
        if (!targetState || !isTodoWorkflowState(targetState)) {
          throw new Error("new issues can only be created in todo");
        }
        tracker.transitionIssue(issue.id, request.workflowStateId);
      }

      logger.info({
        event: "issue_created",
        message: "issue created via tracker service",
        projectId: runtime.config.projectId,
        issueId: issue.id,
        meta: {
          identifier: issue.identifier,
          workflowStateId: request.workflowStateId ?? issue.workflowStateId,
        },
      });
      return;
    }
    case "update": {
      const runtime = ensureDbAndOrchestrator();
      const tracker = new TrackerService(runtime.store);

      if (request.title !== undefined && !request.title.trim()) {
        throw new Error("title is required");
      }

      tracker.updateIssue({
        issueId: request.issueId,
        title: request.title?.trim(),
        description: request.description,
        priority: request.priority,
      });

      logger.info({
        event: "issue_updated",
        message: "issue updated via tracker service",
        projectId: runtime.config.projectId,
        issueId: request.issueId,
        meta: {
          title: request.title !== undefined,
          description: request.description !== undefined,
          priority: request.priority !== undefined,
        },
      });
      return;
    }
  }
}

export function controlRuntime(request: ControlRuntimeRequest): RuntimeStateSnapshot {
  switch (request.action) {
    case "start":
      startOrchestratorRuntime();
      break;
    case "stop":
      stopOrchestratorRuntime();
      break;
    case "tick":
      runOrchestratorTick();
      break;
    case "setPollInterval":
      setOrchestratorPollIntervalMs(request.pollIntervalMs);
      break;
    case "clearPollIntervalOverride":
      clearOrchestratorPollIntervalOverride();
      break;
    case "setPermissionMode":
      setOrchestratorPermissionMode(request.permissionMode);
      break;
    case "clearPermissionModeOverride":
      clearOrchestratorPermissionModeOverride();
      break;
    case "pauseRun":
      pauseRunAttempt(request.runAttemptId);
      break;
    case "resumeRun":
      resumeRunAttempt(request.runAttemptId);
      break;
    case "cancelRun":
      cancelRunAttempt(request.runAttemptId);
      break;
  }
  return getRuntimeState();
}

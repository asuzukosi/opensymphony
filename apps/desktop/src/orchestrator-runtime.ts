import path from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
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
  CandidateSelectionService,
  DEFAULT_RETRY_BASE_DELAY_MS,
  OrchestratorService,
  RestartRecoveryService,
  RunLifecycleService,
  RuntimeConfigService,
  StructuredLoggerService,
  TrackerService,
  WorkflowLoaderService,
  WorkspaceManagerService,
  type RuntimeConfig,
} from "@symphony/core";
import type {
  ControlRuntimeRequest,
  IssueDetail,
  MutateIssueRequest,
  ProjectBoard,
  ProjectBoardIssue,
  RuntimeAuditEvent,
  RuntimeCandidateEntry,
  RuntimeRetryEntry,
  RuntimeRunningEntry,
  RuntimeAdapterKind,
  RuntimeStateSnapshot,
  RuntimeStatus,
  SettingsView,
} from "@/ipc";
import type { AcpAdapter } from "@/runtime/acp";
import { ACP_RUNTIME_KIND, createAcpAdapter, runtimeKindFromAcpMode } from "@/runtime/acp";

interface RuntimeState {
  status: RuntimeStatus;
  runtimeAdapterKind: RuntimeAdapterKind;
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
  runtimeAdapterKind: ACP_RUNTIME_KIND.mock,
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
let runtimeAdapter: AcpAdapter | null = null;
let loadedConfig: RuntimeConfig | null = null;
let loadedWorkflowVersion: string | null = null;
let workspaceManager: WorkspaceManagerService | null = null;
const runAttemptWorkspacePath = new Map<string, string>();
const logger = new StructuredLoggerService();
let timer: ReturnType<typeof setInterval> | null = null;

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

function ensureRuntimeConfig(): RuntimeConfig {
  const loader = new WorkflowLoaderService();
  const configService = new RuntimeConfigService();
  const workflowPath =
    process.env.SYMPHONY_WORKFLOW_PATH ?? path.join(process.cwd(), "WORKFLOW.md");

  try {
    const definition = loader.loadFromFile(workflowPath);
    return configService.toRuntimeConfig(definition);
  } catch {
    return {
      projectId: "desktop-default",
      pollIntervalMs: 30000,
      maxConcurrency: 2,
      retryMaxBackoffMs: 300000,
      workspaceRoot: ".symphony-workspaces",
      acp: {
        mode: "mock",
        command: process.execPath,
        args: ["-e", "setTimeout(() => process.exit(0), 1200)"],
        mockCompletionDelayMs: 1200,
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
  orchestrator = store ? new OrchestratorService(store, config) : null;
  runtimeAdapter = createAcpAdapter(config.acp);
  workspaceManager = new WorkspaceManagerService(
    path.resolve(process.cwd(), config.workspaceRoot),
    config.hooks,
  );
  state.runtimeAdapterKind = runtimeKindFromAcpMode(config.acp.mode);
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
      orchestrator = new OrchestratorService(store, loadedConfig);
    }
  }

  if (!orchestrator) {
    orchestrator = new OrchestratorService(store, config);
  }
  if (!runtimeAdapter) {
    runtimeAdapter = createAcpAdapter(config.acp);
    state.runtimeAdapterKind = runtimeKindFromAcpMode(config.acp.mode);
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
      runtimeAdapter = createAcpAdapter(runtime.config.acp);
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
        workspacePath: workspace.workspacePath,
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

export function getRuntimeState(eventLimit = 20): RuntimeStateSnapshot {
  const runtime = ensureDbAndOrchestrator();
  const candidateSelection = new CandidateSelectionService(
    runtime.store.issues,
    runtime.store.dependencies,
    runtime.store.workflowStates,
  );
  const runningAttempts = runtime.store.runAttempts.listRunningRunAttempts(runtime.config.projectId);
  const retries = runtime.store.retryQueue.listRetries();
  const candidates: RuntimeCandidateEntry[] = candidateSelection
    .listEligible(runtime.config.projectId)
    .map((item) => ({
      issueId: item.issueId,
      identifier: item.identifier,
      title: item.title,
      priority: item.priority,
      stateCategory: item.stateCategory,
    }));

  const running: RuntimeRunningEntry[] = runningAttempts.map((attempt) => {
    const issue = runtime.store.issues.getIssueById(attempt.issueId);
    return {
      runAttemptId: attempt.id,
      issueId: attempt.issueId,
      identifier: issue?.identifier ?? attempt.issueId,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
    };
  });

  const retrying: RuntimeRetryEntry[] = retries.map((entry) => {
    const issue = runtime.store.issues.getIssueById(entry.issueId);
    return {
      issueId: entry.issueId,
      identifier: issue?.identifier ?? entry.issueId,
      attemptNumber: entry.attemptNumber,
      dueAt: entry.dueAt,
      errorMessage: entry.errorMessage,
    };
  });

  const cap = Math.max(0, Math.min(200, Math.floor(eventLimit)));
  const recentEvents: RuntimeAuditEvent[] =
    cap === 0
      ? []
      : runtime.store.audits.listAuditEvents(runtime.config.projectId).slice(0, cap);

  return {
    generatedAt: new Date().toISOString(),
    status: state.status,
    runtimeAdapterKind: state.runtimeAdapterKind,
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
    validationError: null,
    counts: {
      running: running.length,
      retrying: retrying.length,
      candidates: candidates.length,
    },
    running,
    retrying,
    candidates,
    recentEvents,
  };
}

export function getSettings(): SettingsView {
  return {
    status: state.status,
    workflowPath: state.workflowPath,
    workflowVersion: state.workflowVersion,
    runtimeAdapterKind: state.runtimeAdapterKind,
    pollIntervalMs: state.pollIntervalMs,
    pollIntervalSource: state.pollIntervalSource,
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
  const workflowStates = runtime.store.workflowStates.listWorkflowStates(runtime.config.projectId);
  const issues = runtime.store.issues.listIssuesByStateCategories(runtime.config.projectId, [
    "active",
    "backlog",
    "terminal",
    "other",
  ]);
  const issuesByState = new Map<string, ProjectBoardIssue[]>();

  for (const workflowState of workflowStates) {
    issuesByState.set(workflowState.id, []);
  }

  for (const issue of issues) {
    const columnIssues = issuesByState.get(issue.workflowStateId) ?? [];
    columnIssues.push({
      issueId: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      priority: issue.priority,
    });
    issuesByState.set(issue.workflowStateId, columnIssues);
  }

  return {
    columns: workflowStates.map((workflowState) => ({
      stateId: workflowState.id,
      stateName: workflowState.name,
      issues: issuesByState.get(workflowState.id) ?? [],
    })),
  };
}

export function getIssue(issueId: string, attemptLimit = 20): IssueDetail {
  const runtime = ensureDbAndOrchestrator();
  const issue = runtime.store.issues.getIssueById(issueId);
  if (!issue) {
    throw new Error(`issue not found: ${issueId}`);
  }

  const workflowState = runtime.store.workflowStates.getWorkflowStateById(issue.workflowStateId);
  const limit = Math.max(1, Math.min(200, Math.floor(attemptLimit)));
  const attempts = runtime.store.runAttempts.listRunAttemptsByIssue(issueId, limit);

  return {
    issueId: issue.id,
    projectId: issue.projectId,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    workflowStateId: issue.workflowStateId,
    workflowStateName: workflowState?.name ?? "unknown",
    comments: runtime.store.comments.listComments(issueId).map((comment) => ({
      id: comment.id,
      body: comment.body,
      authorId: comment.authorId,
      createdAt: "",
    })),
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
    case "create":
      throw new Error("create issue is not implemented yet");
    case "update":
      throw new Error("update issue is not implemented yet");
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
  }
  return getRuntimeState();
}

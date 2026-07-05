import { existsSync } from "node:fs";
import type { ITrackerStore } from "@symphony/db";
import {
  WorkflowLoaderService,
  formatRuntimeConfigValidationErrors,
  validateRuntimeConfig,
} from "@symphony/core";
import type {
  PollIntervalSource,
  RuntimeAgentTotals,
  RuntimeAuditEvent,
  RuntimeCandidateEntry,
  RuntimeRetryEntry,
  RuntimeRecentFinishedEntry,
  RuntimeRunningEntry,
  RuntimeSessionPhase,
  RuntimeStateCounts,
  RuntimeStateSnapshot,
  RuntimeStatus,
} from "@/ipc";
import { resolveIssueReviewStatus } from "@/lib/issue-review-status";

export interface RuntimeSessionObservability {
  getSessionPhase(sessionId: string): RuntimeSessionPhase | null;
  getLastEventSummary(sessionId: string): string | null;
  isSessionPaused(sessionId: string): boolean;
}

export interface RuntimeSnapshotState {
  status: RuntimeStatus;
  workflowPath: string;
  workflowVersion: string | null;
  workflowLastReloadedAt: string | null;
  startedAt: string | null;
  pollIntervalMs: number;
  pollIntervalSource: PollIntervalSource;
  nextTickAt: string | null;
  tickCount: number;
  lastTickAt: string | null;
  lastDispatchedCount: number;
  lastDeferredCount: number;
  lastCancelledCount: number;
  lastAction: string | null;
  lastError: string | null;
}

export interface BuildRuntimeSnapshotInput {
  store: ITrackerStore;
  projectId: string;
  state: RuntimeSnapshotState;
  candidates: RuntimeCandidateEntry[];
  recentEvents: RuntimeAuditEvent[];
  sessionObservability?: RuntimeSessionObservability | null;
}

export function buildRunningEntries(
  store: ITrackerStore,
  projectId: string,
): RuntimeRunningEntry[] {
  return store.runAttempts.listRunningRunSnapshots(projectId).map((row) => ({
    runAttemptId: row.runAttemptId,
    issueId: row.issueId,
    identifier: row.identifier,
    attemptNumber: row.attemptNumber,
    startedAt: row.startedAt,
    sessionId: row.sessionId,
    sessionStatus: row.sessionStatus,
    phase: null,
    lastEventSummary: null,
    paused: false,
  }));
}

export function enrichRunningEntries(
  running: RuntimeRunningEntry[],
  observability: RuntimeSessionObservability | null | undefined,
): RuntimeRunningEntry[] {
  if (!observability) {
    return running;
  }

  return running.map((entry) => {
    if (!entry.sessionId) {
      return entry;
    }

    return {
      ...entry,
      phase: observability.getSessionPhase(entry.sessionId),
      lastEventSummary: observability.getLastEventSummary(entry.sessionId),
      paused: observability.isSessionPaused(entry.sessionId),
    };
  });
}

export function buildRetryingEntries(
  store: ITrackerStore,
  projectId: string,
): RuntimeRetryEntry[] {
  return store.retryQueue.listRetrySnapshots(projectId).map((row) => ({
    issueId: row.issueId,
    identifier: row.identifier,
    attemptNumber: row.attemptNumber,
    dueAt: row.dueAt,
    errorMessage: row.errorMessage,
  }));
}

export const RECENT_FINISHED_RUN_LIMIT = 20;

export function buildRecentFinishedEntries(
  store: ITrackerStore,
  projectId: string,
  limit = RECENT_FINISHED_RUN_LIMIT,
): RuntimeRecentFinishedEntry[] {
  return store.runAttempts.listRecentFinishedRunSnapshots(projectId, limit).map((row) => ({
    runAttemptId: row.runAttemptId,
    issueId: row.issueId,
    identifier: row.identifier,
    attemptNumber: row.attemptNumber,
    status: row.status,
    finishedAt: row.finishedAt,
    errorMessage: row.errorMessage,
    reviewStatus: resolveIssueReviewStatus(row.status, row.workflowStateCategory),
  }));
}

export function buildCounts(
  running: RuntimeRunningEntry[],
  retrying: RuntimeRetryEntry[],
  candidates: RuntimeCandidateEntry[],
): RuntimeStateCounts {
  return {
    running: running.length,
    retrying: retrying.length,
    candidates: candidates.length,
  };
}

export function buildAgentTotals(running: RuntimeRunningEntry[]): RuntimeAgentTotals {
  let activeSessions = 0;

  for (const entry of running) {
    if (entry.sessionStatus !== "running" || !entry.sessionId) {
      continue;
    }

    activeSessions += 1;
  }

  return { activeSessions };
}

export function resolveWorkflowValidationError(workflowPath: string): string | null {
  if (!existsSync(workflowPath)) {
    return `Missing workflow file: ${workflowPath}`;
  }

  try {
    const loader = new WorkflowLoaderService();
    const definition = loader.loadFromFile(workflowPath);
    const validation = validateRuntimeConfig(definition);
    if (!validation.valid) {
      return formatRuntimeConfigValidationErrors(validation.errors);
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid WORKFLOW.md";
  }
}

export function buildRuntimeSnapshot(input: BuildRuntimeSnapshotInput): RuntimeStateSnapshot {
  const running = enrichRunningEntries(
    buildRunningEntries(input.store, input.projectId),
    input.sessionObservability,
  );
  const retrying = buildRetryingEntries(input.store, input.projectId);
  const recentFinished = buildRecentFinishedEntries(input.store, input.projectId);

  return {
    generatedAt: new Date().toISOString(),
    ...input.state,
    validationError: resolveWorkflowValidationError(input.state.workflowPath),
    counts: buildCounts(running, retrying, input.candidates),
    agentTotals: buildAgentTotals(running),
    running,
    retrying,
    recentFinished,
    candidates: input.candidates,
    recentEvents: input.recentEvents,
  };
}

import type { ITrackerStore } from "@symphony/db";
import { AgentWorkflowService } from "@core/services/agent-workflow-service";
import { AuditService } from "@core/services/audit-service";
import { CandidateSelectionService } from "@core/services/candidate-selection-service";
import { IssueService } from "@core/services/issue-service";
import { RetryService } from "@core/services/retry-service";
import { RunLifecycleService } from "@core/services/run-lifecycle-service";
import { DbTrackerAdapter } from "@core/services/db-tracker-adapter";
import type { RuntimeConfig } from "@core/types/workflow";
import { DEFAULT_ACTIVE_STATE_CATEGORIES, DEFAULT_RETRY_BASE_DELAY_MS } from "@core/types/workflow";

export interface PollCycleResult {
  dispatched: Array<{
    issueId: string;
    identifier: string;
    runAttemptId: string;
    attemptNumber: number;
  }>;
  deferred: Array<{ issueId: string; reason: string }>;
}

export class OrchestratorService {
  private readonly candidateSelection: CandidateSelectionService;
  private readonly retryService: RetryService;
  private readonly runLifecycle: RunLifecycleService;
  private readonly trackerAdapter: DbTrackerAdapter;
  private readonly agentWorkflow: AgentWorkflowService;

  constructor(
    private readonly store: ITrackerStore,
    private readonly config: RuntimeConfig,
  ) {
    const auditService = new AuditService(store.audits);
    const issueService = new IssueService(
      store.projects,
      store.issues,
      store.workflowStates,
      auditService,
    );
    this.agentWorkflow = new AgentWorkflowService(store.issues, issueService);
    this.candidateSelection = new CandidateSelectionService(
      store.issues,
      store.dependencies,
      store.workflowStates,
      store.runAttempts,
    );
    this.retryService = new RetryService(store.retryQueue);
    this.runLifecycle = new RunLifecycleService(store.runAttempts, store.agentSessions);
    this.trackerAdapter = new DbTrackerAdapter(store);
  }

  runPollCycle(nowIso: string): PollCycleResult {
    const currentlyRunning = this.store.runAttempts.listRunningRunAttempts(this.config.projectId);
    const runningIssueIds = new Set(currentlyRunning.map((run) => run.issueId));
    const availableSlots = Math.max(0, this.config.maxConcurrency - currentlyRunning.length);

    const dueRetries = this.retryService.popDueRetries(nowIso);
    for (const retry of dueRetries) {
      if (runningIssueIds.has(retry.issueId)) continue;
      this.startAttempt(retry.issueId, retry.attemptNumber);
      runningIssueIds.add(retry.issueId);
    }

    const remainingSlots = Math.max(0, availableSlots - dueRetries.length);
    const candidates = this.candidateSelection.select({
      projectId: this.config.projectId,
      maxCount: remainingSlots,
    });

    const dispatched: PollCycleResult["dispatched"] = [];
    const deferred: PollCycleResult["deferred"] = [];

    for (const candidate of candidates) {
      if (runningIssueIds.has(candidate.issueId)) {
        deferred.push({ issueId: candidate.issueId, reason: "already_running" });
        continue;
      }

      const latestAttempt = this.store.runAttempts.getLatestRunAttempt(candidate.issueId);
      const attemptNumber = latestAttempt ? latestAttempt.attemptNumber + 1 : 1;
      const runAttemptId = this.startAttempt(candidate.issueId, attemptNumber);
      dispatched.push({
        issueId: candidate.issueId,
        identifier: candidate.identifier,
        runAttemptId,
        attemptNumber,
      });
      runningIssueIds.add(candidate.issueId);
    }

    return { dispatched, deferred };
  }

  markAttemptSucceeded(issueId: string): void {
    this.agentWorkflow.markReadyForHumanReview(issueId, this.config.projectId);
  }

  markAttemptFailed(
    runAttemptId: string,
    issueId: string,
    attemptNumber: number,
    errorMessage: string,
  ): void {
    this.runLifecycle.finishRun(runAttemptId, "failed", errorMessage);
    this.retryService.scheduleRetry({
      issueId,
      attemptNumber: attemptNumber + 1,
      baseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
      maxDelayMs: this.config.retryMaxBackoffMs,
      errorMessage,
    });
  }

  reconcileRunningAttempts(): Array<{
    runAttemptId: string;
    issueId: string;
    action: "cancelled" | "kept";
    reason: string;
  }> {
    const running = this.store.runAttempts.listRunningRunAttempts(this.config.projectId);
    const issueStateById = this.trackerAdapter.getIssueStateCategories(
      running.map((attempt) => attempt.issueId),
    );
    const allowed = new Set<string>(DEFAULT_ACTIVE_STATE_CATEGORIES);
    const results: Array<{
      runAttemptId: string;
      issueId: string;
      action: "cancelled" | "kept";
      reason: string;
    }> = [];

    for (const attempt of running) {
      const category = issueStateById[attempt.issueId] ?? "other";
      if (!allowed.has(category)) {
        this.runLifecycle.finishRun(attempt.id, "cancelled", `reconciled_out_of_scope:${category}`);
        this.store.retryQueue.removeRetry(attempt.issueId);
        results.push({
          runAttemptId: attempt.id,
          issueId: attempt.issueId,
          action: "cancelled",
          reason: category,
        });
        continue;
      }
      results.push({
        runAttemptId: attempt.id,
        issueId: attempt.issueId,
        action: "kept",
        reason: category,
      });
    }

    return results;
  }

  private startAttempt(issueId: string, attemptNumber: number): string {
    const runAttemptId = `${issueId}:attempt:${attemptNumber}`;
    this.runLifecycle.startRun({
      runAttemptId,
      issueId,
      attemptNumber,
    });
    this.agentWorkflow.markInProgress(issueId, this.config.projectId);
    return runAttemptId;
  }
}

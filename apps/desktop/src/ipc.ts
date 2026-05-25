export type OrchestratorStatus = "idle" | "running" | "stopped";

export interface OrchestratorSnapshot {
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

export interface OrchestratorIssueQueues {
  running: Array<{
    runAttemptId: string;
    issueId: string;
    attemptNumber: number;
    startedAt: string;
  }>;
  retryQueue: Array<{
    issueId: string;
    attemptNumber: number;
    dueAt: string;
    errorMessage: string | null;
  }>;
  candidates: Array<{
    issueId: string;
    identifier: string;
    title: string;
    priority: number | null;
    stateCategory: string;
  }>;
}

export interface OrchestratorAuditEvent {
  action: string;
  issueId: string | null;
  payloadJson: string | null;
  createdAt: string;
}

export interface IssueRunHistory {
  issueId: string;
  attempts: Array<{
    runAttemptId: string;
    attemptNumber: number;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
    sessions: Array<{
      sessionId: string;
      runtimeKind: string;
      sessionRef: string | null;
      status: string;
      startedAt: string;
      finishedAt: string | null;
    }>;
  }>;
}

export interface SystemInfo {
  appName: string;
  platform: NodeJS.Platform;
}

export interface SymphonyDesktopApi {
  getSystemInfo(): Promise<SystemInfo>;
  getOrchestratorStatus(): Promise<OrchestratorStatus>;
  getOrchestratorSnapshot(): Promise<OrchestratorSnapshot>;
  getOrchestratorIssueQueues(): Promise<OrchestratorIssueQueues>;
  getRecentAuditEvents(limit?: number): Promise<OrchestratorAuditEvent[]>;
  getIssueRunHistory(issueId: string, limit?: number): Promise<IssueRunHistory>;
  startOrchestratorRuntime(): Promise<OrchestratorSnapshot>;
  stopOrchestratorRuntime(): Promise<OrchestratorSnapshot>;
  runOrchestratorTick(): Promise<OrchestratorSnapshot>;
  setOrchestratorPollIntervalMs(pollIntervalMs: number): Promise<OrchestratorSnapshot>;
  clearOrchestratorPollIntervalOverride(): Promise<OrchestratorSnapshot>;
  transitionIssue(issueId: string, targetStateId: string, actor?: string): Promise<void>;
  addIssueComment(issueId: string, body: string, authorId?: string): Promise<void>;
}

export const IPC_CHANNELS = {
  getSystemInfo: "symphony:get-system-info",
  getOrchestratorStatus: "symphony:get-orchestrator-status",
  getOrchestratorSnapshot: "symphony:get-orchestrator-snapshot",
  getOrchestratorIssueQueues: "symphony:get-orchestrator-issue-queues",
  getRecentAuditEvents: "symphony:get-recent-audit-events",
  getIssueRunHistory: "symphony:get-issue-run-history",
  startOrchestratorRuntime: "symphony:start-orchestrator-runtime",
  stopOrchestratorRuntime: "symphony:stop-orchestrator-runtime",
  runOrchestratorTick: "symphony:run-orchestrator-tick",
  setOrchestratorPollIntervalMs: "symphony:set-orchestrator-poll-interval-ms",
  clearOrchestratorPollIntervalOverride: "symphony:clear-orchestrator-poll-interval-override",
  transitionIssue: "symphony:transition-issue",
  addIssueComment: "symphony:add-issue-comment",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

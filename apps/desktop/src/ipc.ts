export type RuntimeStatus = "idle" | "running" | "stopped";

export type RuntimeAdapterKind = "mock-acp" | "acp-cli";

export type PollIntervalSource = "workflow" | "override";

export interface RuntimeAuditEvent {
  action: string;
  issueId: string | null;
  payloadJson: string | null;
  createdAt: string;
}

export interface RuntimeRunningEntry {
  runAttemptId: string;
  issueId: string;
  identifier: string;
  attemptNumber: number;
  startedAt: string;
  sessionId: string | null;
  runtimeKind: string | null;
  sessionStatus: string | null;
}

export interface RuntimeRetryEntry {
  issueId: string;
  identifier: string;
  attemptNumber: number;
  dueAt: string;
  errorMessage: string | null;
}

export interface RuntimeRecentFinishedEntry {
  runAttemptId: string;
  issueId: string;
  identifier: string;
  attemptNumber: number;
  status: "succeeded" | "failed" | "cancelled";
  finishedAt: string;
  errorMessage: string | null;
}

export interface RuntimeCandidateEntry {
  issueId: string;
  identifier: string;
  title: string;
  priority: number | null;
  stateCategory: string;
}

export interface RuntimeStateCounts {
  running: number;
  retrying: number;
  candidates: number;
}

export interface RuntimeAgentTotals {
  activeSessions: number;
  mockAcp: number;
  acpCli: number;
}

export interface RuntimeStateSnapshot {
  generatedAt: string;
  status: RuntimeStatus;
  runtimeAdapterKind: RuntimeAdapterKind;
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
  validationError: string | null;
  counts: RuntimeStateCounts;
  agentTotals: RuntimeAgentTotals;
  running: RuntimeRunningEntry[];
  retrying: RuntimeRetryEntry[];
  recentFinished: RuntimeRecentFinishedEntry[];
  candidates: RuntimeCandidateEntry[];
  recentEvents: RuntimeAuditEvent[];
}

export interface ProjectBoardIssue {
  issueId: string;
  identifier: string;
  title: string;
  priority: number | null;
}

export interface ProjectBoardColumn {
  stateId: string;
  stateName: string;
  issues: ProjectBoardIssue[];
}

export interface ProjectBoard {
  columns: ProjectBoardColumn[];
}

export interface IssueDetailComment {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: string;
}

export interface IssueDetailSession {
  sessionId: string;
  runtimeKind: string;
  sessionRef: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface IssueDetailRunAttempt {
  runAttemptId: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  sessions: IssueDetailSession[];
}

export interface IssueDetail {
  issueId: string;
  projectId: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number | null;
  workflowStateId: string;
  workflowStateName: string;
  comments: IssueDetailComment[];
  attempts: IssueDetailRunAttempt[];
}

export type MutateIssueRequest =
  | {
      action: "transition";
      issueId: string;
      targetStateId: string;
      actor?: string;
    }
  | {
      action: "comment";
      issueId: string;
      body: string;
      authorId?: string;
    }
  | {
      action: "create";
      projectId: string;
      title: string;
      description?: string;
      priority?: number;
      workflowStateId?: string;
    }
  | {
      action: "update";
      issueId: string;
      title?: string;
      description?: string;
      priority?: number;
    };

export type ControlRuntimeRequest =
  | { action: "start" }
  | { action: "stop" }
  | { action: "tick" }
  | { action: "setPollInterval"; pollIntervalMs: number }
  | { action: "clearPollIntervalOverride" };

export interface SettingsProjectMeta {
  id: string;
  name: string;
  slug: string;
}

export interface SettingsAcpConfig {
  mode: "mock" | "subprocess";
  command: string;
  args: string[];
  mockCompletionDelayMs: number;
}

export interface SettingsView {
  status: RuntimeStatus;
  workflowPath: string;
  workflowVersion: string | null;
  runtimeAdapterKind: RuntimeAdapterKind;
  pollIntervalMs: number;
  pollIntervalSource: PollIntervalSource;
  project: SettingsProjectMeta;
  acp: SettingsAcpConfig;
  startedAt: string | null;
  nextTickAt: string | null;
  tickCount: number;
  lastTickAt: string | null;
  lastAction: string | null;
  lastError: string | null;
}

export interface SymphonyDesktopApi {
  getRuntimeState(eventLimit?: number): Promise<RuntimeStateSnapshot>;
  getProjectBoard(): Promise<ProjectBoard>;
  getIssue(issueId: string, attemptLimit?: number): Promise<IssueDetail>;
  mutateIssue(request: MutateIssueRequest): Promise<void>;
  controlRuntime(request: ControlRuntimeRequest): Promise<RuntimeStateSnapshot>;
  getSettings(): Promise<SettingsView>;
}

export const IPC_CHANNELS = {
  getRuntimeState: "symphony:get-runtime-state",
  getProjectBoard: "symphony:get-project-board",
  getIssue: "symphony:get-issue",
  mutateIssue: "symphony:mutate-issue",
  controlRuntime: "symphony:control-runtime",
  getSettings: "symphony:get-settings",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

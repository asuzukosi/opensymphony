export type RuntimeStatus = "idle" | "running" | "stopped";

export type PollIntervalSource = "workflow" | "override";

export type PermissionMode = "auto_approve" | "requires_approval";

export type PermissionModeSource = "workflow" | "override";

export type PermissionDecision = "approve" | "deny";

export interface PendingPermission {
  id: string;
  sessionId: string;
  issueId: string;
  summary: string;
  payload: unknown;
  createdAt: string;
}

export interface ResolvePermissionRequest {
  id: string;
  decision: PermissionDecision;
}

export interface RuntimeAuditEvent {
  action: string;
  issueId: string | null;
  payloadJson: string | null;
  createdAt: string;
}

import type { RuntimeSessionPhase } from "@/runtime/acp/types";

export type { RuntimeSessionPhase } from "@/runtime/acp/types";

export interface RuntimeRunningEntry {
  runAttemptId: string;
  issueId: string;
  identifier: string;
  attemptNumber: number;
  startedAt: string;
  sessionId: string | null;
  sessionStatus: string | null;
  phase: RuntimeSessionPhase | null;
  lastEventSummary: string | null;
  paused: boolean;
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
  reviewStatus: "approved" | "pending_review" | null;
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
}

export interface RuntimeStateSnapshot {
  generatedAt: string;
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
  validationError: string | null;
  counts: RuntimeStateCounts;
  agentTotals: RuntimeAgentTotals;
  running: RuntimeRunningEntry[];
  retrying: RuntimeRetryEntry[];
  recentFinished: RuntimeRecentFinishedEntry[];
  candidates: RuntimeCandidateEntry[];
  recentEvents: RuntimeAuditEvent[];
}

export type WorkflowStateCategory = "active" | "terminal" | "backlog" | "other";

export interface ProjectBoardIssue {
  issueId: string;
  identifier: string;
  title: string;
  priority: number | null;
}

export interface ProjectBoardColumn {
  stateId: string;
  stateName: string;
  category: WorkflowStateCategory;
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

export type SessionEventKind =
  | "prompt"
  | "stream_chunk"
  | "tool_call"
  | "permission_request"
  | "permission_resolve"
  | "session_update"
  | "error";

export interface SessionEvent {
  id: string;
  kind: SessionEventKind;
  payload: unknown;
  createdAt: string;
}

export interface IssueDetailSession {
  sessionId: string;
  sessionRef: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  events: SessionEvent[];
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
  | { action: "clearPollIntervalOverride" }
  | { action: "setPermissionMode"; permissionMode: PermissionMode }
  | { action: "clearPermissionModeOverride" }
  | { action: "pauseRun"; runAttemptId: string }
  | { action: "resumeRun"; runAttemptId: string }
  | { action: "cancelRun"; runAttemptId: string };

export interface SettingsProjectMeta {
  id: string;
  name: string;
  slug: string;
}

export interface SettingsACPConfig {
  command: string;
  args: string[];
}

export interface SettingsView {
  status: RuntimeStatus;
  workflowPath: string;
  workflowVersion: string | null;
  promptTemplate: string;
  pollIntervalMs: number;
  pollIntervalSource: PollIntervalSource;
  permissionMode: PermissionMode;
  permissionModeSource: PermissionModeSource;
  project: SettingsProjectMeta;
  acp: SettingsACPConfig;
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
  getPendingPermissions(): Promise<PendingPermission[]>;
  resolvePermission(request: ResolvePermissionRequest): Promise<void>;
}

export const IPC_CHANNELS = {
  getRuntimeState: "symphony:get-runtime-state",
  getProjectBoard: "symphony:get-project-board",
  getIssue: "symphony:get-issue",
  mutateIssue: "symphony:mutate-issue",
  controlRuntime: "symphony:control-runtime",
  getSettings: "symphony:get-settings",
  getPendingPermissions: "symphony:get-pending-permissions",
  resolvePermission: "symphony:resolve-permission",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

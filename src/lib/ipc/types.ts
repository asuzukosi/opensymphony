/**
 * ipc payload types for tauri commands and the next.js frontend.
 * mirrors src-tauri/src/types.rs — keep in sync with rust serde json shapes.
 * intentionally slimmer than reference/electron-stack ipc.ts where noted in the migration plan.
 */

// --- runtime ---

export type RuntimeStatus = "idle" | "running" | "stopped";

export type PollIntervalSource = "workflow" | "override";

export type RuntimeSessionPhase =
  | "spawning"
  | "initializing"
  | "prompting"
  | "streaming"
  | "paused"
  | "terminal";

export type RunAttemptStatus = "succeeded" | "failed" | "cancelled";

export type ReviewStatus = "approved" | "pendingReview";

export interface RuntimeAuditEvent {
  action: string;
  issueId: string | null;
  createdAt: string;
}

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
  status: RunAttemptStatus;
  finishedAt: string;
  errorMessage: string | null;
  reviewStatus: ReviewStatus | null;
}

export interface RuntimeCandidateEntry {
  issueId: string;
  identifier: string;
  title: string;
  priority: number | null;
  stateCategory: string;
}

export interface RuntimeStateSnapshot {
  status: RuntimeStatus;
  startedAt: string | null;
  pollIntervalMs: number;
  nextTickAt: string | null;
  tickCount: number;
  lastTickAt: string | null;
  lastDispatchedCount: number;
  lastAction: string | null;
  lastError: string | null;
  validationError: string | null;
  running: RuntimeRunningEntry[];
  retrying: RuntimeRetryEntry[];
  recentFinished: RuntimeRecentFinishedEntry[];
  candidates: RuntimeCandidateEntry[];
  recentEvents: RuntimeAuditEvent[];
}

// --- board ---

export type WorkflowStateCategory = "active" | "terminal" | "backlog" | "other";

export type BoardColumnId = "backlog" | "inProgress" | "review" | "done";

export const BOARD_COLUMN_IDS: readonly BoardColumnId[] = [
  "backlog",
  "inProgress",
  "review",
  "done",
] as const;

export interface ProjectBoardIssue {
  issueId: string;
  identifier: string;
  title: string;
  priority: number | null;
}

export interface BoardColumn {
  issues: ProjectBoardIssue[];
}

export interface ProjectBoard {
  backlog: BoardColumn;
  inProgress: BoardColumn;
  review: BoardColumn;
  done: BoardColumn;
}

// --- issue detail ---

export interface IssueDetailComment {
  id: string;
  body: string;
  author: string | null;
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
      author?: string;
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

// --- runtime control ---

export type PermissionMode = "autoApprove" | "requiresApproval";

export type PermissionModeSource = "workflow" | "override";

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

// --- settings ---

export interface SettingsProjectMeta {
  id: string;
  name: string;
  slug: string;
  agents: string[];
}

export type AgentCommunication = "acp" | "terminal";

export interface SettingsACPConfig {
  command: string;
  args: string[];
}

export interface Agent {
  id: string;
  name: string;
  communication: AgentCommunication;
  acp: SettingsACPConfig | null;
}

export interface SettingsView {
  status: RuntimeStatus;
  workflowPath: string | null;
  workflowVersion: string | null;
  promptTemplate: string;
  pollIntervalMs: number;
  pollIntervalSource: PollIntervalSource;
  permissionMode: PermissionMode;
  permissionModeSource: PermissionModeSource;
  projects: SettingsProjectMeta[];
  agents: Agent[];
  startedAt: string | null;
  nextTickAt: string | null;
  tickCount: number;
  lastTickAt: string | null;
  lastAction: string | null;
  lastError: string | null;
}

// --- permissions ---

export interface PendingPermission {
  id: string;
  sessionId: string;
  issueId: string;
  summary: string;
  payload: unknown;
  createdAt: string;
}

export type PermissionDecision = "approve" | "deny";

export interface ResolvePermissionRequest {
  id: string;
  decision: PermissionDecision;
}

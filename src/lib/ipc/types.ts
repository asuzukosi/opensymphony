/**
 * ipc payload types for tauri commands and the next.js frontend.
 * mirrors src-tauri/src/types/ — keep in sync with rust serde json shapes.
 */

// --- shared ---

export type PermissionDecision = "approve" | "deny";

import type { PlatformId } from "@/lib/platforms";

export type { PlatformId };

// --- board reads ---

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
  executor: PlatformId | null;
}

export interface ProjectIssueListItem extends ProjectBoardIssue {
  boardColumn: BoardColumnId;
}

export interface BoardColumn {
  issues: ProjectBoardIssue[];
}

/** frontend composite grouped from listProjectIssues. */
export interface ProjectBoard {
  backlog: BoardColumn;
  inProgress: BoardColumn;
  review: BoardColumn;
  done: BoardColumn;
}

// --- issue reads ---

export interface IssueHeader {
  issueId: string;
  projectId: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number | null;
  boardColumn: BoardColumnId;
  executor: PlatformId | null;
  autoApprovePermissions: boolean;
  tags: string[];
  files: IssueFile[];
}

export interface IssueFile {
  fileId: string;
  issueId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
}

export interface IssueComment {
  id: string;
  issueId: string;
  body: string;
  author: string | null;
  createdAt: string;
}

export type SessionEventKind =
  | "Prompt"
  | "StreamChunk"
  | "SessionUpdate"
  | "ToolCall"
  | "ToolResult"
  | "PermissionRequest"
  | "Error"
  | "Terminal";

export interface SessionEvent {
  id: string;
  sessionId?: string;
  kind: SessionEventKind;
  payload: unknown;
  createdAt: string;
}

export interface IssueDetailRunAttempt {
  runAttemptId: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export type CreateIssueResponse = IssueHeader;
export type UpdateIssueTitleResponse = IssueHeader;
export type UpdateIssueDescriptionResponse = IssueHeader;
export type UpdateIssuePriorityResponse = IssueHeader;
export type TransitionIssueColumnResponse = IssueHeader;
export type SetIssueExecutorResponse = IssueHeader;
export type SetIssueAutoApprovePermissionsResponse = IssueHeader;
export type SetIssueTagsResponse = IssueHeader;
export type AttachIssueFilesResponse = IssueFile[];
export type AddIssueCommentResponse = IssueComment;

// --- permissions reads ---

export interface PendingPermission {
  id: string;
  sessionId: string;
  issueId: string;
  summary: string;
  createdAt: string;
}

// --- runtime reads ---

export type RuntimeStatus = "idle" | "running" | "stopped";

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
  currentActivity: string | null;
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

// --- analytics reads ---

export interface ActivityTimeRange {
  startAt: string;
  endAt: string;
  bucketMs: number;
}

export type AgentActivityEventKind = Exclude<SessionEventKind, "StreamChunk">;

export type AgentActivityByKind = Partial<Record<AgentActivityEventKind, number>>;

export interface AgentActivityOverTimeBucket {
  bucketStart: string;
  totalEvents: number;
  byKind?: AgentActivityByKind;
  projectId?: string;
  projectName?: string;
}

export interface AgentActivitySummary {
  totalEvents: number;
  runAttemptCount: number;
  sessionCount: number;
}

export interface AgentActivityOverTimeResponse {
  buckets: AgentActivityOverTimeBucket[];
  summary?: AgentActivitySummary;
}

// --- project reads ---

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  orchestratorStatus: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
}

export type CreateProjectResponse = ProjectSummary;
export type SetProjectNameResponse = string;
export type SetProjectPollIntervalResponse = number;
export type SetProjectMaxConcurrencyResponse = number;
export type SetProjectRetryPolicyResponse = RetryPolicy;

// --- platform ---

export interface PlatformInstallStatus {
  platform: PlatformId;
  label: string;
  installed: boolean;
  missingBinaries: string[];
}

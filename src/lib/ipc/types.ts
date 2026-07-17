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

export interface ProjectBoardTask {
  taskId: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number | null;
  executor: PlatformId | null;
}

export interface ProjectTaskListItem extends ProjectBoardTask {
  boardColumn: BoardColumnId;
}

export interface BoardColumn {
  tasks: ProjectBoardTask[];
}

/** frontend composite grouped from listProjectTasks. */
export interface ProjectBoard {
  backlog: BoardColumn;
  inProgress: BoardColumn;
  review: BoardColumn;
  done: BoardColumn;
}

// --- task reads ---

export interface TaskHeader {
  taskId: string;
  projectId: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number | null;
  boardColumn: BoardColumnId;
  executor: PlatformId | null;
  autoApprovePermissions: boolean;
  tags: string[];
  files: TaskFile[];
}

export interface TaskFile {
  fileId: string;
  taskId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
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

export interface TaskDetailRunAttempt {
  runAttemptId: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export type CreateTaskResponse = TaskHeader;
export type UpdateTaskPriorityResponse = TaskHeader;
export type TransitionTaskColumnResponse = TaskHeader;
export type SetTaskExecutorResponse = TaskHeader;
export type SetTaskAutoApprovePermissionsResponse = TaskHeader;
export type SetTaskTagsResponse = TaskHeader;
export type AttachTaskFilesResponse = TaskFile[];
export type AddTaskCommentResponse = TaskComment;

// --- permissions reads ---

export interface PendingPermission {
  id: string;
  sessionId: string;
  taskId: string;
  summary: string;
  createdAt: string;
}

// --- runtime reads ---

export type RuntimeStatus = "idle" | "running";

export type RuntimeSessionPhase =
  | "spawning"
  | "initializing"
  | "prompting"
  | "streaming"
  | "paused"
  | "terminal";

export type RunAttemptStatus = "succeeded" | "failed" | "cancelled";

export type ReviewStatus = "approved" | "pendingReview";

export interface RuntimeRunningEntry {
  runAttemptId: string;
  taskId: string;
  title: string;
  description: string | null;
  executor: PlatformId | null;
  attemptNumber: number;
  startedAt: string;
  phase: RuntimeSessionPhase | null;
  paused: boolean;
}

export interface RuntimeRetryEntry {
  taskId: string;
  title: string;
  description: string | null;
  executor: PlatformId | null;
  attemptNumber: number;
  dueAt: string;
  errorMessage: string | null;
}

export interface RuntimeRecentFinishedEntry {
  runAttemptId: string;
  taskId: string;
  title: string;
  description: string | null;
  executor: PlatformId | null;
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

export interface AgentActivityOverTimeBucket {
  bucketStart: string;
  totalEvents: number;
  projectId?: string;
  projectName?: string;
}

export interface AgentActivityOverTimeResponse {
  buckets: AgentActivityOverTimeBucket[];
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
export type SetProjectMaxConcurrencyResponse = number;
export type SetProjectRetryPolicyResponse = RetryPolicy;

// --- platform ---

export interface PlatformInstallStatus {
  platform: PlatformId;
  label: string;
  installed: boolean;
  missingBinaries: string[];
}

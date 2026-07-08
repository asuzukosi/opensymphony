/**
 * ipc payload types for tauri commands and the next.js frontend.
 * mirrors src-tauri/src/types/ — keep in sync with rust serde json shapes.
 */

// --- shared ---

export type PermissionMode = "autoApprove" | "requiresApproval";

export type PermissionDecision = "approve" | "deny";

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
}

export interface BoardColumn {
  issues: ProjectBoardIssue[];
}

/** frontend composite assembled from getBoardColumn calls. */
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

// --- issue writes ---

export interface CreateIssueRequest {
  projectId: string;
  title: string;
  description?: string | null;
}

export interface TransitionIssueColumnRequest {
  issueId: string;
  column: BoardColumnId;
  actor?: string | null;
}

export interface AddIssueCommentRequest {
  issueId: string;
  body: string;
  author?: string | null;
}

export type CreateIssueResponse = IssueHeader;
export type UpdateIssueTitleResponse = IssueHeader;
export type UpdateIssueDescriptionResponse = IssueHeader;
export type UpdateIssuePriorityResponse = IssueHeader;
export type TransitionIssueColumnResponse = IssueHeader;
export type AddIssueCommentResponse = IssueComment;

// --- permissions reads ---

export interface PendingPermission {
  id: string;
  sessionId: string;
  issueId: string;
  summary: string;
  payload: unknown;
  createdAt: string;
}

// --- permissions writes ---

export interface ResolveSessionPermissionRequest {
  permissionId: string;
  decision: PermissionDecision;
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

export interface RuntimeCandidateEntry {
  issueId: string;
  identifier: string;
  title: string;
  priority: number | null;
  stateCategory: string;
}

export interface RuntimeSummary {
  status: RuntimeStatus;
  pollIntervalMs: number;
  startedAt: string | null;
  nextTickAt: string | null;
  tickCount: number;
  lastTickAt: string | null;
  lastDispatchedCount: number;
  lastAction: string | null;
  lastError: string | null;
  validationError: string | null;
}

// --- runtime writes ---

export interface RunControlRequest {
  projectId: string;
  runAttemptId: string;
}

export type StartRuntimeResponse = RuntimeSummary;
export type StopRuntimeResponse = RuntimeSummary;
export type TickRuntimeResponse = RuntimeSummary;
export type SetRuntimePollIntervalResponse = number;
export type ClearRuntimePollIntervalOverrideResponse = number;

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
}

export interface AgentActivityOverTimeResponse {
  buckets: AgentActivityOverTimeBucket[];
}

export interface PermissionActivityOverTimeBucket {
  bucketStart: string;
  activePending: number;
  requestsOpened: number;
  requestsResolved: number;
}

export interface PermissionActivityOverTimeResponse {
  buckets: PermissionActivityOverTimeBucket[];
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

export interface Project {
  id: string;
  name: string;
  slug: string;
  workspaceRoot: string | null;
  workflowSource: string | null;
  workflowFilePath: string | null;
  workflowFileMtime: string | null;
  workflowVersion: string | null;
  workflowLastLoadedAt: string | null;
  maxConcurrency: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
  promptTemplate: string;
  pollIntervalMs: number;
  permissionMode: PermissionMode;
  orchestratorStatus: string;
  createdAt: string;
  updatedAt: string;
}

// --- project writes ---

export interface SetProjectWorkflowFileRequest {
  projectId: string;
  sourcePath: string;
}

export interface SetProjectRetryPolicyRequest {
  maxAttempts: number;
  backoffMs: number;
}

export type CreateProjectResponse = ProjectSummary;
export type SetProjectNameResponse = string;
export type SetProjectWorkflowFileResponse = string | null;
export type SetProjectPromptTemplateResponse = string;
export type SetProjectPollIntervalResponse = number;
export type SetProjectMaxConcurrencyResponse = number;
export type SetProjectRetryPolicyResponse = RetryPolicy;
export type SetProjectPermissionModeResponse = PermissionMode;

// --- agent reads ---

export interface AgentSummary {
  id: string;
  name: string;
}

export interface Agent {
  id: string;
  name: string;
  acpCommand: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- agent writes ---

export interface CreateAgentRequest {
  name: string;
  acpCommand?: string | null;
}

export interface AssignAgentToProjectRequest {
  projectId: string;
  agentId: string;
}

export type CreateAgentResponse = Agent;
export type SetAgentNameResponse = string;
export type SetAgentAcpCommandResponse = string | null;

// --- app state reads ---

export type GetActiveProjectIdResponse = string | null;

// --- app state writes ---

export type SetActiveProjectIdResponse = string | null;

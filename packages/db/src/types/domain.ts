export type WorkflowStateCategory = "active" | "terminal" | "backlog" | "other";
export type RunAttemptStatus = "running" | "succeeded" | "failed" | "cancelled";
export type AgentSessionStatus = "running" | "succeeded" | "failed" | "cancelled";

export type SessionEventKind =
  | "prompt"
  | "stream_chunk"
  | "tool_call"
  | "permission_request"
  | "permission_resolve"
  | "session_update"
  | "error";

export interface SessionEventRow {
  id: string;
  sessionId: string;
  kind: SessionEventKind;
  payloadJson: string;
  createdAt: string;
}

export interface AppendSessionEventInput {
  id?: string;
  sessionId: string;
  kind: SessionEventKind;
  payload: unknown;
  createdAt?: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
}

export interface WorkflowStateRow {
  id: string;
  projectId: string;
  name: string;
  category: WorkflowStateCategory;
  position: number;
}

export interface IssueRow {
  id: string;
  projectId: string;
  workflowStateId: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number | null;
}

export interface IssuesByWorkflowStateColumn {
  workflowStateId: string;
  workflowStateName: string;
  category: WorkflowStateCategory;
  position: number;
  issues: IssueRow[];
}

export interface IssueDetailCommentRow {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: string;
}

export interface IssueDetailSessionRow {
  sessionId: string;
  sessionRef: string | null;
  status: AgentSessionStatus;
  startedAt: string;
  finishedAt: string | null;
  events: SessionEventRow[];
}

export interface IssueDetailRunAttemptRow {
  runAttemptId: string;
  attemptNumber: number;
  status: RunAttemptStatus;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  sessions: IssueDetailSessionRow[];
}

export interface IssueDetailRow {
  issueId: string;
  projectId: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number | null;
  workflowStateId: string;
  workflowStateName: string;
  comments: IssueDetailCommentRow[];
  attempts: IssueDetailRunAttemptRow[];
}

export interface IssueCommentRow {
  id: string;
  issueId: string;
  body: string;
  authorId: string | null;
}

export interface LabelRow {
  id: string;
  projectId: string;
  name: string;
  color: string | null;
}

export interface AssignmentRow {
  id: string;
  issueId: string;
  assigneeId: string;
  assignedAt: string;
  unassignedAt: string | null;
}

export interface RunAttemptRow {
  id: string;
  issueId: string;
  attemptNumber: number;
  status: RunAttemptStatus;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export interface RunningRunSnapshotRow {
  runAttemptId: string;
  issueId: string;
  identifier: string;
  attemptNumber: number;
  startedAt: string;
  sessionId: string | null;
  sessionStatus: AgentSessionStatus | null;
}

export interface RecentFinishedRunSnapshotRow {
  runAttemptId: string;
  issueId: string;
  identifier: string;
  attemptNumber: number;
  status: Exclude<RunAttemptStatus, "running">;
  finishedAt: string;
  errorMessage: string | null;
  workflowStateCategory: WorkflowStateCategory;
}

export interface AgentSessionRow {
  id: string;
  runAttemptId: string;
  sessionRef: string | null;
  status: AgentSessionStatus;
  startedAt: string;
  finishedAt: string | null;
}

export interface RetryQueueRow {
  issueId: string;
  attemptNumber: number;
  dueAt: string;
  errorMessage: string | null;
}

export interface RetryRunSnapshotRow {
  issueId: string;
  identifier: string;
  attemptNumber: number;
  dueAt: string;
  errorMessage: string | null;
}

export interface AuditEventInput {
  id: string;
  projectId?: string | null;
  issueId?: string | null;
  actor?: string | null;
  action: string;
  payloadJson?: string | null;
}

export type WorkflowStateCategory = "active" | "terminal" | "backlog" | "other";
export type RunAttemptStatus = "running" | "succeeded" | "failed" | "cancelled";
export type AgentSessionStatus = "running" | "succeeded" | "failed" | "cancelled";

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

export interface AgentSessionRow {
  id: string;
  runAttemptId: string;
  runtimeKind: string;
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

export interface AuditEventInput {
  id: string;
  projectId?: string | null;
  issueId?: string | null;
  actor?: string | null;
  action: string;
  payloadJson?: string | null;
}

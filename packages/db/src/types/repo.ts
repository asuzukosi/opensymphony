import type {
  AgentSessionRow,
  AssignmentRow,
  AuditEventInput,
  IssueCommentRow,
  IssueRow,
  LabelRow,
  ProjectRow,
  RetryQueueRow,
  RunAttemptRow,
  RunAttemptStatus,
  WorkflowStateCategory,
  WorkflowStateRow,
} from "@db/types/domain";

export interface IProjectRepo {
  getProject(projectId: string): ProjectRow | null;
}

export interface IWorkflowStateRepo {
  listWorkflowStates(projectId: string): WorkflowStateRow[];
  getWorkflowStateById(stateId: string): WorkflowStateRow | null;
  findDefaultWorkflowState(projectId: string): WorkflowStateRow | null;
}

export interface IIssueRepo {
  createIssue(input: IssueRow): void;
  updateIssueState(issueId: string, workflowStateId: string): void;
  getIssueById(issueId: string): IssueRow | null;
  setIssueAssignee(issueId: string, assigneeId: string | null): void;
  listIssuesByStateCategories(projectId: string, categories: WorkflowStateCategory[]): IssueRow[];
}

export interface ICommentRepo {
  addComment(input: IssueCommentRow): void;
  listComments(issueId: string): IssueCommentRow[];
}

export interface ILabelRepo {
  upsertLabel(input: LabelRow): void;
  attachLabel(issueId: string, labelId: string): void;
  listIssueLabels(issueId: string): LabelRow[];
}

export interface IAssignmentRepo {
  closeActiveAssignments(issueId: string): void;
  addAssignment(issueId: string, assignmentId: string, assigneeId: string): void;
  getActiveAssignment(issueId: string): AssignmentRow | null;
  listAssignmentHistory(issueId: string): AssignmentRow[];
}

export interface IDependencyRepo {
  addDependency(issueId: string, dependsOnIssueId: string): void;
  listDependenciesWithState(
    issueId: string,
  ): Array<{ dependsOnIssueId: string; dependencyCategory: WorkflowStateCategory }>;
}

export interface IRunAttemptRepo {
  createRunAttempt(input: {
    id: string;
    issueId: string;
    attemptNumber: number;
    status: RunAttemptStatus;
    errorMessage?: string | null;
  }): void;
  updateRunAttemptStatus(
    runAttemptId: string,
    status: RunAttemptStatus,
    errorMessage?: string | null,
  ): void;
  getLatestRunAttempt(issueId: string): RunAttemptRow | null;
  listRunningRunAttempts(projectId: string): RunAttemptRow[];
  listRunAttemptsByIssue(issueId: string, limit?: number): RunAttemptRow[];
}

export interface IAgentSessionRepo {
  createSession(input: {
    id: string;
    runAttemptId: string;
    runtimeKind: string;
    sessionRef?: string | null;
    status: "running" | "succeeded" | "failed" | "cancelled";
  }): void;
  updateSessionStatus(
    sessionId: string,
    status: "running" | "succeeded" | "failed" | "cancelled",
  ): void;
  listSessionsByRunAttempt(runAttemptId: string): AgentSessionRow[];
}

export interface IRetryQueueRepo {
  upsertRetry(input: RetryQueueRow): void;
  removeRetry(issueId: string): void;
  getRetry(issueId: string): RetryQueueRow | null;
  listDueRetries(nowIso: string): RetryQueueRow[];
  listRetries(): RetryQueueRow[];
}

export interface IAuditRepo {
  insertAuditEvent(input: AuditEventInput): void;
  listAuditEvents(
    projectId: string,
  ): Array<{
    action: string;
    issueId: string | null;
    payloadJson: string | null;
    createdAt: string;
  }>;
}

export interface ITrackerStore {
  projects: IProjectRepo;
  workflowStates: IWorkflowStateRepo;
  issues: IIssueRepo;
  comments: ICommentRepo;
  labels: ILabelRepo;
  assignments: IAssignmentRepo;
  dependencies: IDependencyRepo;
  runAttempts: IRunAttemptRepo;
  agentSessions: IAgentSessionRepo;
  retryQueue: IRetryQueueRepo;
  audits: IAuditRepo;
}

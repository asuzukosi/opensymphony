import type {
  AgentSessionRow,
  AppendSessionEventInput,
  AssignmentRow,
  AuditEventInput,
  IssueCommentRow,
  IssueDetailRow,
  IssueRow,
  IssuesByWorkflowStateColumn,
  LabelRow,
  ProjectRow,
  RetryQueueRow,
  RetryRunSnapshotRow,
  RunAttemptRow,
  SessionEventRow,
  RunAttemptStatus,
  RunningRunSnapshotRow,
  RecentFinishedRunSnapshotRow,
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
  updateIssue(
    issueId: string,
    input: { title?: string; description?: string | null; priority?: number | null },
  ): void;
  getIssueById(issueId: string): IssueRow | null;
  setIssueAssignee(issueId: string, assigneeId: string | null): void;
  listIssuesByStateCategories(projectId: string, categories: WorkflowStateCategory[]): IssueRow[];
  listIssuesGroupedByWorkflowState(projectId: string): IssuesByWorkflowStateColumn[];
  getIssueDetail(issueId: string, attemptLimit?: number): IssueDetailRow | null;
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
  listRunningRunSnapshots(projectId: string): RunningRunSnapshotRow[];
  listRecentFinishedRunSnapshots(projectId: string, limit?: number): RecentFinishedRunSnapshotRow[];
  listRunAttemptsByIssue(issueId: string, limit?: number): RunAttemptRow[];
  hasSucceededRunAttempt(issueId: string): boolean;
}

export interface IAgentSessionRepo {
  createSession(input: {
    id: string;
    runAttemptId: string;
    sessionRef?: string | null;
    status: "running" | "succeeded" | "failed" | "cancelled";
  }): void;
  updateSessionStatus(
    sessionId: string,
    status: "running" | "succeeded" | "failed" | "cancelled",
  ): void;
  updateSessionRef(sessionId: string, sessionRef: string): void;
  listSessionsByRunAttempt(runAttemptId: string): AgentSessionRow[];
}

export interface ISessionEventRepo {
  append(input: AppendSessionEventInput): SessionEventRow;
  listBySessionId(sessionId: string): SessionEventRow[];
}

export interface IRetryQueueRepo {
  upsertRetry(input: RetryQueueRow): void;
  removeRetry(issueId: string): void;
  getRetry(issueId: string): RetryQueueRow | null;
  listDueRetries(nowIso: string): RetryQueueRow[];
  listRetries(): RetryQueueRow[];
  listRetrySnapshots(projectId: string): RetryRunSnapshotRow[];
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
  sessionEvents: ISessionEventRepo;
  retryQueue: IRetryQueueRepo;
  audits: IAuditRepo;
}

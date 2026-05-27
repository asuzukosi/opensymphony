export {
  closeDatabase,
  openDatabase,
  type OpenDatabaseOptions,
  type SqliteDatabase,
} from "@db/client";
export {
  ensureMigrationTable,
  listAppliedMigrations,
  migrateDown,
  migrateUp,
  type MigrationRecord,
} from "@db/migrations";
export { seedProjectWithDefaultStates, type SeedProjectInput } from "@db/seed";
export { createTrackerStore } from "@db/store";
export { SESSION_EVENT_TAIL_CAP } from "@db/repos/session-event-repo";
export type {
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
  RunAttemptRow,
  RunAttemptStatus,
  SessionEventKind,
  SessionEventRow,
  RetryRunSnapshotRow,
  RecentFinishedRunSnapshotRow,
  RunningRunSnapshotRow,
  WorkflowStateCategory,
  WorkflowStateRow,
} from "@db/types/domain";
export type {
  IAgentSessionRepo,
  IAssignmentRepo,
  IAuditRepo,
  ICommentRepo,
  IDependencyRepo,
  IIssueRepo,
  ILabelRepo,
  IProjectRepo,
  IRetryQueueRepo,
  IRunAttemptRepo,
  ISessionEventRepo,
  ITrackerStore,
  IWorkflowStateRepo,
} from "@db/types/repo";

export function dbReady(): string {
  return "db-ready";
}

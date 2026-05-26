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
export type {
  AgentSessionRow,
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
  ITrackerStore,
  IWorkflowStateRepo,
} from "@db/types/repo";

export function dbReady(): string {
  return "db-ready";
}

import type { SqliteDatabase } from "@db/client";
import type { ITrackerStore } from "@db/types/repo";
import { ProjectRepo } from "@db/repos/project-repo";
import { WorkflowStateRepo } from "@db/repos/workflow-state-repo";
import { IssueRepo } from "@db/repos/issue-repo";
import { CommentRepo } from "@db/repos/comment-repo";
import { LabelRepo } from "@db/repos/label-repo";
import { AssignmentRepo } from "@db/repos/assignment-repo";
import { DependencyRepo } from "@db/repos/dependency-repo";
import { RunAttemptRepo } from "@db/repos/run-attempt-repo";
import { AgentSessionRepo } from "@db/repos/agent-session-repo";
import { SessionEventRepo } from "@db/repos/session-event-repo";
import { RetryQueueRepo } from "@db/repos/retry-queue-repo";
import { AuditRepo } from "@db/repos/audit-repo";

export function createTrackerStore(db: SqliteDatabase): ITrackerStore {
  return {
    projects: new ProjectRepo(db),
    workflowStates: new WorkflowStateRepo(db),
    issues: new IssueRepo(db),
    comments: new CommentRepo(db),
    labels: new LabelRepo(db),
    assignments: new AssignmentRepo(db),
    dependencies: new DependencyRepo(db),
    runAttempts: new RunAttemptRepo(db),
    agentSessions: new AgentSessionRepo(db),
    sessionEvents: new SessionEventRepo(db),
    retryQueue: new RetryQueueRepo(db),
    audits: new AuditRepo(db),
  };
}

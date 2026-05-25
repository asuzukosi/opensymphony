import type {
  AssignmentRow,
  ITrackerStore,
  IssueCommentRow,
  LabelRow,
  SqliteDatabase,
} from "@symphony/db";
import { createTrackerStore } from "@symphony/db";
import { AuditService } from "@core/services/audit-service";
import { IssueService } from "@core/services/issue-service";
import { DependencyService } from "@core/services/dependency-service";
import { CommentService } from "@core/services/comment-service";
import { LabelService } from "@core/services/label-service";
import { AssignmentService } from "@core/services/assignment-service";
import type {
  AddCommentInput,
  AddDependencyInput,
  AddLabelInput,
  AssignIssueInput,
  CreateIssueInput,
} from "@core/types/tracker";

export class TrackerService {
  private readonly auditService: AuditService;
  private readonly issueService: IssueService;
  private readonly dependencyService: DependencyService;
  private readonly commentService: CommentService;
  private readonly labelService: LabelService;
  private readonly assignmentService: AssignmentService;

  constructor(private readonly store: ITrackerStore) {
    this.auditService = new AuditService(store.audits);
    this.issueService = new IssueService(
      store.projects,
      store.issues,
      store.workflowStates,
      this.auditService,
    );
    this.dependencyService = new DependencyService(
      store.issues,
      store.dependencies,
      this.auditService,
    );
    this.commentService = new CommentService(store.issues, store.comments, this.auditService);
    this.labelService = new LabelService(store.issues, store.labels, this.auditService);
    this.assignmentService = new AssignmentService(
      store.issues,
      store.assignments,
      this.auditService,
    );
  }

  static fromDatabase(db: SqliteDatabase): TrackerService {
    return new TrackerService(createTrackerStore(db));
  }

  createIssue(input: CreateIssueInput) {
    return this.issueService.create(input);
  }

  transitionIssue(issueId: string, targetStateId: string, actor?: string) {
    return this.issueService.transition({ issueId, targetStateId, actor });
  }

  addDependency(
    input: AddDependencyInput["issueId"] | AddDependencyInput,
    dependsOnIssueId?: string,
    actor?: string,
  ): void {
    if (typeof input === "string") {
      if (!dependsOnIssueId) throw new Error("dependsOnIssueId is required");
      this.dependencyService.add({ issueId: input, dependsOnIssueId, actor });
      return;
    }

    this.dependencyService.add(input);
  }

  isIssueBlocked(issueId: string): boolean {
    return this.dependencyService.isBlocked(issueId);
  }

  addComment(input: AddCommentInput): void {
    this.commentService.add(input);
  }

  listComments(issueId: string): IssueCommentRow[] {
    return this.commentService.list(issueId);
  }

  addLabelToIssue(input: AddLabelInput): void {
    this.labelService.addToIssue(input);
  }

  listIssueLabels(issueId: string): LabelRow[] {
    return this.labelService.listForIssue(issueId);
  }

  assignIssue(input: AssignIssueInput): void {
    this.assignmentService.assign(input);
  }

  getActiveAssignment(issueId: string): AssignmentRow | null {
    return this.assignmentService.current(issueId);
  }

  listAssignmentHistory(issueId: string): AssignmentRow[] {
    return this.assignmentService.history(issueId);
  }

  getAuditEvents(projectId: string) {
    return this.auditService.list(projectId);
  }
}

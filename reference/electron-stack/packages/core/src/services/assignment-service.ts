import type { AssignmentRow, IAssignmentRepo, IIssueRepo } from "@symphony/db";
import type { AssignIssueInput } from "@core/types/tracker";
import { AuditService } from "@core/services/audit-service";

export class AssignmentService {
  constructor(
    private readonly issues: IIssueRepo,
    private readonly assignments: IAssignmentRepo,
    private readonly audit: AuditService,
  ) {}

  assign(input: AssignIssueInput): void {
    const issue = this.issues.getIssueById(input.issueId);
    if (!issue) throw new Error(`Issue not found: ${input.issueId}`);

    this.assignments.closeActiveAssignments(input.issueId);
    this.assignments.addAssignment(input.issueId, input.assignmentId, input.assigneeId);
    this.issues.setIssueAssignee(input.issueId, input.assigneeId);

    this.audit.write({
      id: `audit:${input.issueId}:assignment:${input.assignmentId}`,
      projectId: issue.projectId,
      issueId: input.issueId,
      actor: input.actor,
      action: "issue.assigned",
      payload: { assigneeId: input.assigneeId, assignmentId: input.assignmentId },
    });
  }

  current(issueId: string): AssignmentRow | null {
    return this.assignments.getActiveAssignment(issueId);
  }

  history(issueId: string): AssignmentRow[] {
    return this.assignments.listAssignmentHistory(issueId);
  }
}

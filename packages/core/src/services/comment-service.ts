import type { ICommentRepo, IIssueRepo, IssueCommentRow } from "@symphony/db";
import type { AddCommentInput } from "@core/types/tracker";
import { AuditService } from "@core/services/audit-service";

export class CommentService {
  constructor(
    private readonly issues: IIssueRepo,
    private readonly comments: ICommentRepo,
    private readonly audit: AuditService,
  ) {}

  add(input: AddCommentInput): void {
    const issue = this.issues.getIssueById(input.issueId);
    if (!issue) throw new Error(`Issue not found: ${input.issueId}`);

    this.comments.addComment({
      id: input.id,
      issueId: input.issueId,
      body: input.body,
      authorId: input.authorId ?? null,
    });

    this.audit.write({
      id: `audit:${input.issueId}:comment:${input.id}`,
      projectId: issue.projectId,
      issueId: input.issueId,
      actor: input.actor,
      action: "issue.comment.added",
      payload: { commentId: input.id },
    });
  }

  list(issueId: string): IssueCommentRow[] {
    return this.comments.listComments(issueId);
  }
}

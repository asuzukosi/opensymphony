import type { ILabelRepo, IIssueRepo, LabelRow } from "@symphony/db";
import type { AddLabelInput } from "@core/types/tracker";
import { AuditService } from "@core/services/audit-service";

export class LabelService {
  constructor(
    private readonly issues: IIssueRepo,
    private readonly labels: ILabelRepo,
    private readonly audit: AuditService,
  ) {}

  addToIssue(input: AddLabelInput): void {
    const issue = this.issues.getIssueById(input.issueId);
    if (!issue) throw new Error(`Issue not found: ${input.issueId}`);
    if (issue.projectId !== input.projectId) {
      throw new Error("Issue does not belong to the provided project");
    }

    this.labels.upsertLabel({
      id: input.id,
      projectId: input.projectId,
      name: input.name,
      color: input.color ?? null,
    });
    this.labels.attachLabel(input.issueId, input.id);

    this.audit.write({
      id: `audit:${input.issueId}:label:${input.id}`,
      projectId: input.projectId,
      issueId: input.issueId,
      actor: input.actor,
      action: "issue.label.added",
      payload: { labelId: input.id, labelName: input.name },
    });
  }

  listForIssue(issueId: string): LabelRow[] {
    return this.labels.listIssueLabels(issueId);
  }
}

import type { IIssueRepo } from "@symphony/db";
import { IssueService } from "@core/services/issue-service";

export const WORKFLOW_STATE_SUFFIX = {
  inProgress: "in_progress",
  humanReview: "human_review",
} as const;

export function workflowStateId(projectId: string, stateSuffix: string): string {
  return `${projectId}:${stateSuffix}`;
}

export class AgentWorkflowService {
  constructor(
    private readonly issues: IIssueRepo,
    private readonly issueService: IssueService,
  ) {}

  markInProgress(issueId: string, projectId: string): void {
    this.transitionIfNeeded(
      issueId,
      workflowStateId(projectId, WORKFLOW_STATE_SUFFIX.inProgress),
    );
  }

  markReadyForHumanReview(issueId: string, projectId: string): void {
    this.transitionIfNeeded(
      issueId,
      workflowStateId(projectId, WORKFLOW_STATE_SUFFIX.humanReview),
    );
  }

  private transitionIfNeeded(issueId: string, targetStateId: string): void {
    const issue = this.issues.getIssueById(issueId);
    if (!issue || issue.workflowStateId === targetStateId) {
      return;
    }

    this.issueService.transition({
      issueId,
      targetStateId,
      actor: "symphony-agent",
    });
  }
}

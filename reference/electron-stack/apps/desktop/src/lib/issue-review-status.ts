import type { WorkflowStateCategory } from "@/ipc";

export type IssueReviewStatus = "approved" | "pending_review";

export function doneWorkflowStateId(projectId: string): string {
  return `${projectId}:done`;
}

export function isHumanReviewState(workflowStateId: string): boolean {
  return workflowStateId.endsWith(":human_review");
}

export function resolveIssueReviewStatus(
  runStatus: "succeeded" | "failed" | "cancelled",
  workflowStateCategory: WorkflowStateCategory,
): IssueReviewStatus | null {
  if (runStatus !== "succeeded") {
    return null;
  }

  return workflowStateCategory === "terminal" ? "approved" : "pending_review";
}

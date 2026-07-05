import type { ITrackerStore } from "@symphony/db";

export class DbTrackerAdapter {
  constructor(private readonly store: ITrackerStore) {}

  getIssueStateCategories(issueIds: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const issueId of issueIds) {
      const issue = this.store.issues.getIssueById(issueId);
      if (!issue) continue;
      const state = this.store.workflowStates.getWorkflowStateById(issue.workflowStateId);
      result[issueId] = state?.category ?? "other";
    }
    return result;
  }
}

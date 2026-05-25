import { randomUUID } from "node:crypto";
import type { ITrackerStore, WorkflowStateCategory } from "@symphony/db";
import type { TrackerAdapter, TrackerIssueSnapshot } from "@core/types/tracker-adapter";

export class DbTrackerAdapter implements TrackerAdapter {
  constructor(private readonly store: ITrackerStore) {}

  listCandidateIssues(projectId: string, categories: string[]): TrackerIssueSnapshot[] {
    const typedCategories = categories as WorkflowStateCategory[];
    const issues = this.store.issues.listIssuesByStateCategories(projectId, typedCategories);
    return issues.map((issue) => {
      const state = this.store.workflowStates.getWorkflowStateById(issue.workflowStateId);
      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        priority: issue.priority,
        stateCategory: state?.category ?? "other",
      };
    });
  }

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

  transitionIssue(issueId: string, targetStateId: string): void {
    this.store.issues.updateIssueState(issueId, targetStateId);
  }

  addIssueComment(issueId: string, body: string, authorId?: string): void {
    this.store.comments.addComment({
      id: randomUUID(),
      issueId,
      body,
      authorId: authorId ?? null,
    });
  }
}

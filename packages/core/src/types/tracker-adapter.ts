export type TrackerProviderKind = "db" | "linear";

export interface TrackerIssueSnapshot {
  id: string;
  identifier: string;
  title: string;
  priority: number | null;
  stateCategory: string;
}

export interface TrackerAdapter {
  listCandidateIssues(projectId: string, categories: string[]): TrackerIssueSnapshot[];
  getIssueStateCategories(issueIds: string[]): Record<string, string>;
  transitionIssue(issueId: string, targetStateId: string, actor?: string): void;
  addIssueComment(issueId: string, body: string, authorId?: string): void;
}

export interface CreateIssueInput {
  id: string;
  projectId: string;
  identifier: string;
  title: string;
  description?: string;
  priority?: number;
  actor?: string;
}

export interface TransitionIssueInput {
  issueId: string;
  targetStateId: string;
  actor?: string;
}

export interface AddDependencyInput {
  issueId: string;
  dependsOnIssueId: string;
  actor?: string;
}

export interface AddCommentInput {
  id: string;
  issueId: string;
  body: string;
  authorId?: string;
  actor?: string;
}

export interface AddLabelInput {
  id: string;
  projectId: string;
  issueId: string;
  name: string;
  color?: string;
  actor?: string;
}

export interface AssignIssueInput {
  issueId: string;
  assigneeId: string;
  assignmentId: string;
  actor?: string;
}

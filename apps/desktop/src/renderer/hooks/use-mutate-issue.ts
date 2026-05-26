import type { MutateIssueRequest } from "@/ipc";
import { useIpcMutation } from "./use-ipc-mutation";

export type TransitionIssueInput = {
  issueId: string;
  targetStateId: string;
  actor?: string;
};

export type AddIssueCommentInput = {
  issueId: string;
  body: string;
  authorId?: string;
};

export type CreateIssueInput = {
  projectId: string;
  title: string;
  description?: string;
  priority?: number;
  workflowStateId?: string;
};

export type UpdateIssueInput = {
  issueId: string;
  title?: string;
  description?: string;
  priority?: number;
};

export type UseMutateIssueResult = {
  transition: (input: TransitionIssueInput) => Promise<void>;
  addComment: (input: AddIssueCommentInput) => Promise<void>;
  createIssue: (input: CreateIssueInput) => Promise<void>;
  updateIssue: (input: UpdateIssueInput) => Promise<void>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
};

export function useMutateIssue(): UseMutateIssueResult {
  const mutateMutation = useIpcMutation<MutateIssueRequest, void>((client, request) =>
    client.mutateIssue(request),
  );

  return {
    transition: (input) =>
      mutateMutation.mutateAsync({
        action: "transition",
        issueId: input.issueId,
        targetStateId: input.targetStateId,
        actor: input.actor,
      }),
    addComment: (input) =>
      mutateMutation.mutateAsync({
        action: "comment",
        issueId: input.issueId,
        body: input.body,
        authorId: input.authorId,
      }),
    createIssue: (input) =>
      mutateMutation.mutateAsync({
        action: "create",
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        workflowStateId: input.workflowStateId,
      }),
    updateIssue: (input) =>
      mutateMutation.mutateAsync({
        action: "update",
        issueId: input.issueId,
        title: input.title,
        description: input.description,
        priority: input.priority,
      }),
    isPending: mutateMutation.isPending,
    error: mutateMutation.error,
    reset: mutateMutation.reset,
  };
}

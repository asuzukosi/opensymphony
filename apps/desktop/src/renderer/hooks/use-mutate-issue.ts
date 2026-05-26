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

export type UseMutateIssueResult = {
  transition: (input: TransitionIssueInput) => Promise<void>;
  addComment: (input: AddIssueCommentInput) => Promise<void>;
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
    isPending: mutateMutation.isPending,
    error: mutateMutation.error,
    reset: mutateMutation.reset,
  };
}

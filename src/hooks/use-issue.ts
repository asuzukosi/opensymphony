"use client";

import { useCallback } from "react";

import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type {
  AddIssueCommentResponse,
  IssueComment,
  IssueDetailRunAttempt,
  IssueHeader,
  SessionEvent,
  UpdateIssuePriorityResponse,
  SetIssueExecutorResponse,
  SetIssueTagsResponse,
} from "@/lib/ipc/types";
import type { PlatformId } from "@/lib/platforms";

export type IssueDetail = IssueHeader & {
  comments: IssueComment[];
  attempts: IssueDetailRunAttempt[];
  sessionEvents: SessionEvent[];
};

type IssueWriteInput =
  | { action: "updatePriority"; priority: number | null }
  | { action: "setExecutor"; executor: PlatformId | null }
  | { action: "setAutoApprovePermissions"; autoApprovePermissions: boolean }
  | { action: "setTags"; tags: string[] }
  | { action: "attachFiles"; filePaths: string[] }
  | { action: "addComment"; body: string; author?: string | null };

type IssueWriteMutationInput = IssueWriteInput & {
  issueId: string;
};

export type UseIssueOptions = {
  issueId: string | null;
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseIssueResult = {
  issue: IssueDetail | undefined;
  error: Error | null;
  isLoading: boolean;
  updatePriority: (priority: number | null) => Promise<void>;
  setExecutor: (executor: PlatformId | null) => Promise<void>;
  setAutoApprovePermissions: (autoApprovePermissions: boolean) => Promise<void>;
  setTags: (tags: string[]) => Promise<void>;
  attachFiles: (filePaths: string[]) => Promise<void>;
  addComment: (body: string, author?: string | null) => Promise<void>;
  isMutating: boolean;
  mutationError: Error | null;
  resetMutation: () => void;
};

function requireIssueId(issueId: string | null): string {
  if (issueId == null) {
    throw new Error("no issue selected");
  }
  return issueId;
}

export function useIssue(options: UseIssueOptions): UseIssueResult {
  const {
    issueId,
    pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS,
    enabled: enabledOption = true,
  } = options;
  const enabled = enabledOption && issueId != null;

  const { data, error, isLoading, refetch } = useIpcQuery<IssueDetail>(
    `issue:${issueId ?? "none"}`,
    async (client) => {
      const id = issueId as string;
      const [header, comments, attempts, sessionEvents] = await Promise.all([
        client.getIssueHeader(id),
        client.listIssueComments(id),
        client.listIssueRunAttempts(id),
        client.listSessionEvents(id),
      ]);

      return {
        ...header,
        comments,
        attempts,
        sessionEvents,
      };
    },
    { pollIntervalMs, enabled },
  );

  const {
    mutateAsync: writeIssue,
    isPending: isMutating,
    error: mutationError,
    reset: resetMutation,
  } = useIpcMutation<
    IssueWriteMutationInput,
    | IssueHeader
    | UpdateIssuePriorityResponse
    | SetIssueExecutorResponse
    | SetIssueTagsResponse
    | AddIssueCommentResponse
  >(async (client, input) => {
    switch (input.action) {
      case "updatePriority":
        return client.updateIssuePriority(input.issueId, input.priority);
      case "setExecutor":
        return client.setIssueExecutor(input.issueId, input.executor);
      case "setAutoApprovePermissions":
        return client.setIssueAutoApprovePermissions(
          input.issueId,
          input.autoApprovePermissions,
        );
      case "setTags":
        return client.setIssueTags(input.issueId, input.tags);
      case "attachFiles":
        await client.attachIssueFiles(input.issueId, input.filePaths);
        return client.getIssueHeader(input.issueId);
      case "addComment":
        return client.addIssueComment(input.issueId, input.body, input.author ?? null);
    }
  });

  const mutateAndRefetch = useCallback(
    async (input: IssueWriteInput): Promise<void> => {
      const id = requireIssueId(issueId);
      await writeIssue({ ...input, issueId: id });
      await refetch();
    },
    [issueId, refetch, writeIssue],
  );

  const updatePriority = useCallback(
    async (priority: number | null): Promise<void> => {
      await mutateAndRefetch({ action: "updatePriority", priority });
    },
    [mutateAndRefetch],
  );

  const setExecutor = useCallback(
    async (executor: PlatformId | null): Promise<void> => {
      await mutateAndRefetch({ action: "setExecutor", executor });
    },
    [mutateAndRefetch],
  );

  const setAutoApprovePermissions = useCallback(
    async (autoApprovePermissions: boolean): Promise<void> => {
      await mutateAndRefetch({ action: "setAutoApprovePermissions", autoApprovePermissions });
    },
    [mutateAndRefetch],
  );

  const setTags = useCallback(
    async (tags: string[]): Promise<void> => {
      await mutateAndRefetch({ action: "setTags", tags });
    },
    [mutateAndRefetch],
  );

  const attachFiles = useCallback(
    async (filePaths: string[]): Promise<void> => {
      await mutateAndRefetch({ action: "attachFiles", filePaths });
    },
    [mutateAndRefetch],
  );

  const addComment = useCallback(
    async (body: string, author?: string | null): Promise<void> => {
      await mutateAndRefetch({ action: "addComment", body, author });
    },
    [mutateAndRefetch],
  );

  return {
    issue: data,
    error,
    isLoading,
    updatePriority,
    setExecutor,
    setAutoApprovePermissions,
    setTags,
    attachFiles,
    addComment,
    isMutating,
    mutationError,
    resetMutation,
  };
}

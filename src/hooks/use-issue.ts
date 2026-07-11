"use client";

import { useCallback } from "react";

import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type {
  AddIssueCommentResponse,
  BoardColumnId,
  IssueComment,
  IssueDetailRunAttempt,
  IssueHeader,
  SessionEvent,
  TransitionIssueColumnResponse,
  UpdateIssueDescriptionResponse,
  UpdateIssuePriorityResponse,
  UpdateIssueTitleResponse,
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
  | { action: "updateTitle"; title: string }
  | { action: "updateDescription"; description: string | null }
  | { action: "updatePriority"; priority: number | null }
  | { action: "transitionColumn"; column: BoardColumnId; actor?: string | null }
  | { action: "setExecutor"; executor: PlatformId | null }
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
  isRefreshing: boolean;
  refetch: () => Promise<void>;
  updateTitle: (title: string) => Promise<void>;
  updateDescription: (description: string | null) => Promise<void>;
  updatePriority: (priority: number | null) => Promise<void>;
  transitionColumn: (column: BoardColumnId, actor?: string | null) => Promise<void>;
  setExecutor: (executor: PlatformId | null) => Promise<void>;
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

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<IssueDetail>(
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
    | UpdateIssueTitleResponse
    | UpdateIssueDescriptionResponse
    | UpdateIssuePriorityResponse
    | TransitionIssueColumnResponse
    | SetIssueExecutorResponse
    | SetIssueTagsResponse
    | AddIssueCommentResponse
  >(async (client, input) => {
    switch (input.action) {
      case "updateTitle":
        return client.updateIssueTitle(input.issueId, input.title);
      case "updateDescription":
        return client.updateIssueDescription(input.issueId, input.description);
      case "updatePriority":
        return client.updateIssuePriority(input.issueId, input.priority);
      case "transitionColumn":
        return client.transitionIssueColumn(input.issueId, input.column, input.actor ?? null);
      case "setExecutor":
        return client.setIssueExecutor(input.issueId, input.executor);
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

  const updateTitle = useCallback(
    async (title: string): Promise<void> => {
      await mutateAndRefetch({ action: "updateTitle", title });
    },
    [mutateAndRefetch],
  );

  const updateDescription = useCallback(
    async (description: string | null): Promise<void> => {
      await mutateAndRefetch({ action: "updateDescription", description });
    },
    [mutateAndRefetch],
  );

  const updatePriority = useCallback(
    async (priority: number | null): Promise<void> => {
      await mutateAndRefetch({ action: "updatePriority", priority });
    },
    [mutateAndRefetch],
  );

  const transitionColumn = useCallback(
    async (column: BoardColumnId, actor?: string | null): Promise<void> => {
      await mutateAndRefetch({ action: "transitionColumn", column, actor });
    },
    [mutateAndRefetch],
  );

  const setExecutor = useCallback(
    async (executor: PlatformId | null): Promise<void> => {
      await mutateAndRefetch({ action: "setExecutor", executor });
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
    isRefreshing,
    refetch,
    updateTitle,
    updateDescription,
    updatePriority,
    transitionColumn,
    setExecutor,
    setTags,
    attachFiles,
    addComment,
    isMutating,
    mutationError,
    resetMutation,
  };
}

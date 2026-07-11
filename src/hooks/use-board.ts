"use client";

import { useCallback } from "react";

import { useActiveProject } from "@/contexts/active-project-context";
import { groupIssuesByColumn } from "@/lib/group-issues-by-column";
import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import { requireProjectId } from "@/lib/require-project-id";
import type {
  BoardColumnId,
  CreateIssueResponse,
  PlatformId,
  ProjectBoardIssue,
} from "@/lib/ipc/types";

export type CreateIssueInput = {
  projectId?: string;
  title: string;
  description?: string | null;
  priority?: number | null;
  executor?: PlatformId | null;
  tags?: string[];
  filePaths?: string[];
};

type TransitionIssueInput = {
  issueId: string;
  column: BoardColumnId;
  actor?: string | null;
};

type CreateIssueMutationInput = CreateIssueInput & {
  resolvedProjectId: string;
};

export type UseBoardResult = {
  issuesByColumn: Record<BoardColumnId, ProjectBoardIssue[] | undefined>;
  error: Error | null;
  isLoading: boolean;
  transitionIssue: (
    issueId: string,
    column: BoardColumnId,
    actor?: string | null,
  ) => Promise<void>;
  isTransitioning: boolean;
  transitionError: Error | null;
  resetTransition: () => void;
  createIssue: (input: CreateIssueInput) => Promise<CreateIssueResponse>;
  isCreating: boolean;
  createError: Error | null;
  resetCreate: () => void;
};

export function useBoard(): UseBoardResult {
  const { projectId } = useActiveProject();
  const enabled = projectId != null;

  const { data, error, isLoading, refetch } = useIpcQuery(
    `board:${projectId ?? "none"}`,
    async (client) => {
      const id = projectId as string;
      const issues = await client.listProjectIssues(id);
      return groupIssuesByColumn(issues);
    },
    { pollIntervalMs: DEFAULT_IPC_POLL_INTERVAL_MS, enabled },
  );

  const {
    mutateAsync: transitionIssueColumn,
    isPending: isTransitioning,
    error: transitionError,
    reset: resetTransition,
  } = useIpcMutation(async (client, input: TransitionIssueInput) => {
    await client.transitionIssueColumn(input.issueId, input.column, input.actor ?? null);
  });

  const transitionIssue = useCallback(
    async (issueId: string, column: BoardColumnId, actor?: string | null): Promise<void> => {
      await transitionIssueColumn({ issueId, column, actor });
      await refetch();
    },
    [refetch, transitionIssueColumn],
  );

  const {
    mutateAsync: createIssueMutation,
    isPending: isCreating,
    error: createError,
    reset: resetCreate,
  } = useIpcMutation(async (client, input: CreateIssueMutationInput) => {
    const issue = await client.createIssue(
      input.resolvedProjectId,
      input.title,
      input.description ?? null,
      input.executor ?? null,
      input.priority ?? null,
      input.tags ?? [],
    );

    if (input.filePaths != null && input.filePaths.length > 0) {
      await client.attachIssueFiles(issue.issueId, input.filePaths);
    }

    return issue;
  });

  const createIssue = useCallback(
    async (input: CreateIssueInput): Promise<CreateIssueResponse> => {
      const resolvedProjectId = requireProjectId(input.projectId ?? projectId);
      const issue = await createIssueMutation({ ...input, resolvedProjectId });
      await refetch();
      return issue;
    },
    [createIssueMutation, projectId, refetch],
  );

  const issuesByColumn = data ?? {
    backlog: undefined,
    inProgress: undefined,
    review: undefined,
    done: undefined,
  };

  return {
    issuesByColumn,
    error,
    isLoading,
    transitionIssue,
    isTransitioning,
    transitionError,
    resetTransition,
    createIssue,
    isCreating,
    createError,
    resetCreate,
  };
}

"use client";

import { useCallback } from "react";

import { useActiveProject } from "@/contexts/active-project-context";
import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import { requireProjectId } from "@/lib/require-project-id";
import type {
  BoardColumn,
  BoardColumnId,
  CreateIssueResponse,
  ProjectBoardIssue,
} from "@/lib/ipc/types";

export const BOARD_COLUMN_IDS: BoardColumnId[] = ["backlog", "inProgress", "review", "done"];

export type CreateIssueInput = {
  projectId?: string;
  title: string;
  description?: string | null;
  priority?: number | null;
};

type BoardData = Record<BoardColumnId, BoardColumn>;

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
  columns: BoardData | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
  refetchColumn: (column: BoardColumnId) => Promise<void>;
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

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<BoardData>(
    `board:${projectId ?? "none"}`,
    async (client) => {
      const id = projectId as string;
      const [backlog, inProgress, review, done] = await Promise.all(
        BOARD_COLUMN_IDS.map((column) => client.getBoardColumn(id, column)),
      );
      return { backlog, inProgress, review, done };
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
    );

    if (input.priority !== undefined) {
      return client.updateIssuePriority(issue.issueId, input.priority);
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

  const refetchColumn = useCallback(async (_column: BoardColumnId): Promise<void> => {
    await refetch();
  }, [refetch]);

  const issuesByColumn: Record<BoardColumnId, ProjectBoardIssue[] | undefined> = {
    backlog: data?.backlog.issues,
    inProgress: data?.inProgress.issues,
    review: data?.review.issues,
    done: data?.done.issues,
  };

  return {
    issuesByColumn,
    columns: data,
    error,
    isLoading,
    isRefreshing,
    refetch,
    refetchColumn,
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

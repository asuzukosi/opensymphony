"use client";

import { useCallback } from "react";

import { useActiveProject } from "@/contexts/active-project-context";
import { groupTasksByColumn } from "@/lib/group-tasks-by-column";
import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import { requireProjectId } from "@/lib/require-project-id";
import type {
  BoardColumnId,
  CreateTaskResponse,
  PlatformId,
  ProjectBoardTask,
} from "@/lib/ipc/types";

export type CreateTaskInput = {
  projectId?: string;
  title: string;
  description?: string | null;
  priority?: number | null;
  executor?: PlatformId | null;
  tags?: string[];
  filePaths?: string[];
};

type TransitionTaskInput = {
  taskId: string;
  column: BoardColumnId;
  actor?: string | null;
};

type CreateTaskMutationInput = CreateTaskInput & {
  resolvedProjectId: string;
};

export type UseBoardResult = {
  tasksByColumn: Record<BoardColumnId, ProjectBoardTask[] | undefined>;
  error: Error | null;
  isLoading: boolean;
  transitionTask: (
    taskId: string,
    column: BoardColumnId,
    actor?: string | null,
  ) => Promise<void>;
  isTransitioning: boolean;
  transitionError: Error | null;
  resetTransition: () => void;
  createTask: (input: CreateTaskInput) => Promise<CreateTaskResponse>;
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
      const tasks = await client.listProjectTasks(id);
      return groupTasksByColumn(tasks);
    },
    { pollIntervalMs: DEFAULT_IPC_POLL_INTERVAL_MS, enabled },
  );

  const {
    mutateAsync: transitionTaskColumn,
    isPending: isTransitioning,
    error: transitionError,
    reset: resetTransition,
  } = useIpcMutation(async (client, input: TransitionTaskInput) => {
    await client.transitionTaskColumn(input.taskId, input.column, input.actor ?? null);
  });

  const transitionTask = useCallback(
    async (taskId: string, column: BoardColumnId, actor?: string | null): Promise<void> => {
      await transitionTaskColumn({ taskId, column, actor });
      await refetch();
    },
    [refetch, transitionTaskColumn],
  );

  const {
    mutateAsync: createTaskMutation,
    isPending: isCreating,
    error: createError,
    reset: resetCreate,
  } = useIpcMutation(async (client, input: CreateTaskMutationInput) => {
    const task = await client.createTask(
      input.resolvedProjectId,
      input.title,
      input.description ?? null,
      input.executor ?? null,
      input.priority ?? null,
      input.tags ?? [],
    );

    if (input.filePaths != null && input.filePaths.length > 0) {
      await client.attachTaskFiles(task.taskId, input.filePaths);
    }

    return task;
  });

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<CreateTaskResponse> => {
      const resolvedProjectId = requireProjectId(input.projectId ?? projectId);
      const task = await createTaskMutation({ ...input, resolvedProjectId });
      await refetch();
      return task;
    },
    [createTaskMutation, projectId, refetch],
  );

  const tasksByColumn = data ?? {
    backlog: undefined,
    inProgress: undefined,
    review: undefined,
    done: undefined,
  };

  return {
    tasksByColumn,
    error,
    isLoading,
    transitionTask,
    isTransitioning,
    transitionError,
    resetTransition,
    createTask,
    isCreating,
    createError,
    resetCreate,
  };
}

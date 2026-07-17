"use client";

import { useCallback } from "react";

import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type {
  AddTaskCommentResponse,
  TaskComment,
  TaskDetailRunAttempt,
  TaskHeader,
  SessionEvent,
  UpdateTaskPriorityResponse,
  SetTaskExecutorResponse,
  SetTaskTagsResponse,
} from "@/lib/ipc/types";
import type { PlatformId } from "@/lib/platforms";

export type TaskDetail = TaskHeader & {
  comments: TaskComment[];
  attempts: TaskDetailRunAttempt[];
  sessionEvents: SessionEvent[];
};

type TaskWriteInput =
  | { action: "updatePriority"; priority: number | null }
  | { action: "setExecutor"; executor: PlatformId | null }
  | { action: "setAutoApprovePermissions"; autoApprovePermissions: boolean }
  | { action: "setTags"; tags: string[] }
  | { action: "attachFiles"; filePaths: string[] }
  | { action: "addComment"; body: string; author?: string | null };

type TaskWriteMutationInput = TaskWriteInput & {
  taskId: string;
};

export type UseTaskOptions = {
  taskId: string | null;
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseTaskResult = {
  task: TaskDetail | undefined;
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

function requireTaskId(taskId: string | null): string {
  if (taskId == null) {
    throw new Error("no task selected");
  }
  return taskId;
}

export function useTask(options: UseTaskOptions): UseTaskResult {
  const {
    taskId,
    pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS,
    enabled: enabledOption = true,
  } = options;
  const enabled = enabledOption && taskId != null;

  const { data, error, isLoading, refetch } = useIpcQuery<TaskDetail>(
    `task:${taskId ?? "none"}`,
    async (client) => {
      const id = taskId as string;
      const [header, comments, attempts, sessionEvents] = await Promise.all([
        client.getTaskHeader(id),
        client.listTaskComments(id),
        client.listTaskRunAttempts(id),
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
    mutateAsync: writeTask,
    isPending: isMutating,
    error: mutationError,
    reset: resetMutation,
  } = useIpcMutation<
    TaskWriteMutationInput,
    | TaskHeader
    | UpdateTaskPriorityResponse
    | SetTaskExecutorResponse
    | SetTaskTagsResponse
    | AddTaskCommentResponse
  >(async (client, input) => {
    switch (input.action) {
      case "updatePriority":
        return client.updateTaskPriority(input.taskId, input.priority);
      case "setExecutor":
        return client.setTaskExecutor(input.taskId, input.executor);
      case "setAutoApprovePermissions":
        return client.setTaskAutoApprovePermissions(
          input.taskId,
          input.autoApprovePermissions,
        );
      case "setTags":
        return client.setTaskTags(input.taskId, input.tags);
      case "attachFiles":
        await client.attachTaskFiles(input.taskId, input.filePaths);
        return client.getTaskHeader(input.taskId);
      case "addComment":
        return client.addTaskComment(input.taskId, input.body, input.author ?? null);
    }
  });

  const mutateAndRefetch = useCallback(
    async (input: TaskWriteInput): Promise<void> => {
      const id = requireTaskId(taskId);
      await writeTask({ ...input, taskId: id });
      await refetch();
    },
    [taskId, refetch, writeTask],
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
    task: data,
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

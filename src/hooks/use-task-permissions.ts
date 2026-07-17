"use client";

import { useCallback } from "react";

import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type { PendingPermission, PermissionDecision } from "@/lib/ipc/types";

export const ACTIVE_PERMISSION_POLL_INTERVAL_MS = 2000;

type ResolvePermissionInput = {
  permissionId: string;
  decision: PermissionDecision;
};

export type UseTaskPermissionsOptions = {
  taskId: string | null;
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseTaskPermissionsResult = {
  permissions: PendingPermission[] | undefined;
  error: Error | null;
  isLoading: boolean;
  resolvePermission: (permissionId: string, decision: PermissionDecision) => Promise<void>;
  isResolving: boolean;
  resolveError: Error | null;
  resetResolve: () => void;
};

function requireTaskId(taskId: string | null): string {
  if (taskId == null) {
    throw new Error("no task selected");
  }
  return taskId;
}

export function useTaskPermissions(
  options: UseTaskPermissionsOptions,
): UseTaskPermissionsResult {
  const {
    taskId,
    pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS,
    enabled: enabledOption = true,
  } = options;
  const enabled = enabledOption && taskId != null;

  const { data, error, isLoading, refetch } = useIpcQuery<PendingPermission[]>(
    `task-permissions:${taskId ?? "none"}`,
    async (client) => client.listTaskPendingPermissions(taskId as string),
    { pollIntervalMs, enabled },
  );

  const {
    mutateAsync: resolveSessionPermission,
    isPending: isResolving,
    error: resolveError,
    reset: resetResolve,
  } = useIpcMutation(async (client, input: ResolvePermissionInput) => {
    await client.resolveSessionPermission(input.permissionId, input.decision);
  });

  const resolvePermission = useCallback(
    async (permissionId: string, decision: PermissionDecision): Promise<void> => {
      requireTaskId(taskId);
      await resolveSessionPermission({ permissionId, decision });
      await refetch();
    },
    [taskId, refetch, resolveSessionPermission],
  );

  return {
    permissions: data,
    error,
    isLoading,
    resolvePermission,
    isResolving,
    resolveError,
    resetResolve,
  };
}

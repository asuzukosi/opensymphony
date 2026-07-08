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

export type UseIssuePermissionsOptions = {
  issueId: string | null;
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseIssuePermissionsResult = {
  permissions: PendingPermission[] | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
  resolvePermission: (permissionId: string, decision: PermissionDecision) => Promise<void>;
  isResolving: boolean;
  resolveError: Error | null;
  resetResolve: () => void;
};

function requireIssueId(issueId: string | null): string {
  if (issueId == null) {
    throw new Error("no issue selected");
  }
  return issueId;
}

export function useIssuePermissions(
  options: UseIssuePermissionsOptions,
): UseIssuePermissionsResult {
  const {
    issueId,
    pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS,
    enabled: enabledOption = true,
  } = options;
  const enabled = enabledOption && issueId != null;

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<PendingPermission[]>(
    `issue-permissions:${issueId ?? "none"}`,
    async (client) => client.listIssuePendingPermissions(issueId as string),
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
      requireIssueId(issueId);
      await resolveSessionPermission({ permissionId, decision });
      await refetch();
    },
    [issueId, refetch, resolveSessionPermission],
  );

  return {
    permissions: data,
    error,
    isLoading,
    isRefreshing,
    refetch,
    resolvePermission,
    isResolving,
    resolveError,
    resetResolve,
  };
}

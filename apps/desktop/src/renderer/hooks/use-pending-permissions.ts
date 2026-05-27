import { useCallback, useState } from "react";
import type { PendingPermission, PermissionDecision } from "@/ipc";
import { useIpcMutation } from "./use-ipc-mutation";
import { useIpcQuery } from "./use-ipc-query";
import { useSettings } from "./use-settings";

export type UsePendingPermissionsOptions = {
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UsePendingPermissionsResult = {
  permissions: PendingPermission[];
  pendingCount: number;
  isApprovalRequired: boolean;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
  resolve: (id: string, decision: PermissionDecision) => void;
  resolveAsync: (id: string, decision: PermissionDecision) => Promise<void>;
  isResolving: boolean;
  resolvingId: string | null;
  resolveError: Error | null;
  resetResolveError: () => void;
};

const DEFAULT_POLL_INTERVAL_MS = 2000;

export function usePendingPermissions(
  options?: UsePendingPermissionsOptions,
): UsePendingPermissionsResult {
  const { pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, enabled = true } = options ?? {};
  const { settings } = useSettings({ pollIntervalMs: 0, enabled });
  const isApprovalRequired = settings?.permissionMode === "requires_approval";

  const {
    data,
    error,
    isLoading,
    isRefreshing,
    refetch,
  } = useIpcQuery<PendingPermission[]>(
    "pending-permissions",
    (client) => client.getPendingPermissions(),
    {
      pollIntervalMs,
      enabled: enabled && isApprovalRequired,
    },
  );

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const resolveMutation = useIpcMutation<
    { id: string; decision: PermissionDecision },
    void
  >((client, request) => client.resolvePermission(request));

  const resolveAsync = useCallback(
    async (id: string, decision: PermissionDecision): Promise<void> => {
      setResolvingId(id);
      try {
        await resolveMutation.mutateAsync({ id, decision });
        await refetch();
      } finally {
        setResolvingId(null);
      }
    },
    [refetch, resolveMutation],
  );

  const resolve = useCallback(
    (id: string, decision: PermissionDecision): void => {
      void resolveAsync(id, decision);
    },
    [resolveAsync],
  );

  return {
    permissions: isApprovalRequired ? (data ?? []) : [],
    pendingCount: isApprovalRequired ? (data?.length ?? 0) : 0,
    isApprovalRequired,
    error,
    isLoading: isApprovalRequired ? isLoading : false,
    isRefreshing: isApprovalRequired ? isRefreshing : false,
    refetch,
    resolve,
    resolveAsync,
    isResolving: resolveMutation.isPending,
    resolvingId,
    resolveError: resolveMutation.error,
    resetResolveError: resolveMutation.reset,
  };
}

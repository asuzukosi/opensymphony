import type { RuntimeStateSnapshot } from "@/ipc";
import { DEFAULT_IPC_POLL_INTERVAL_MS, useIpcQuery } from "./use-ipc-query";

export type UseRuntimeStateOptions = {
  pollIntervalMs?: number;
  auditEventLimit?: number;
  enabled?: boolean;
};

export type UseRuntimeStateResult = {
  snapshot: RuntimeStateSnapshot | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
};

const DEFAULT_AUDIT_EVENT_LIMIT = 10;

export function useRuntimeState(options?: UseRuntimeStateOptions): UseRuntimeStateResult {
  const {
    pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS,
    auditEventLimit = DEFAULT_AUDIT_EVENT_LIMIT,
    enabled = true,
  } = options ?? {};

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<RuntimeStateSnapshot>(
    `runtime-state:${auditEventLimit}`,
    (client) => client.getRuntimeState(auditEventLimit),
    { pollIntervalMs, enabled },
  );

  return {
    snapshot: data,
    error,
    isLoading,
    isRefreshing,
    refetch,
  };
}

import type { SettingsView } from "@/ipc";
import { DEFAULT_IPC_POLL_INTERVAL_MS, useIpcQuery } from "./use-ipc-query";

export type { SettingsView } from "@/ipc";

export type UseSettingsOptions = {
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseSettingsResult = {
  settings: SettingsView | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
};

export function useSettings(options?: UseSettingsOptions): UseSettingsResult {
  const { pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS, enabled = true } = options ?? {};

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<SettingsView>(
    "settings",
    (client) => client.getSettings(),
    { pollIntervalMs, enabled },
  );

  return {
    settings: data,
    error,
    isLoading,
    isRefreshing,
    refetch,
  };
}

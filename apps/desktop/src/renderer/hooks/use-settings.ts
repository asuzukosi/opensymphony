import type { SettingsView } from "@/ipc";
import { useIpcQuery } from "./use-ipc-query";

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

const DEFAULT_POLL_INTERVAL_MS = 5000;

export function useSettings(options?: UseSettingsOptions): UseSettingsResult {
  const { pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, enabled = true } = options ?? {};

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

"use client";

import { useCallback, useMemo } from "react";

import { useIpcQuery } from "@/lib/ipc/hooks";
import type { PlatformInstallStatus } from "@/lib/ipc/types";
import { isPlatformId, type PlatformId } from "@/lib/platforms";

export type UsePlatformStatusesResult = {
  statuses: PlatformInstallStatus[] | undefined;
  byPlatformId: Map<PlatformId, PlatformInstallStatus>;
  isPlatformInstalled: (platformId: PlatformId) => boolean;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
};

export function usePlatformStatuses(): UsePlatformStatusesResult {
  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<PlatformInstallStatus[]>(
    "platform-statuses",
    (client) => client.listAgentPlatformStatuses(),
  );

  const byPlatformId = useMemo(() => {
    const map = new Map<PlatformId, PlatformInstallStatus>();
    for (const status of data ?? []) {
      if (isPlatformId(status.platform)) {
        map.set(status.platform, { ...status, platform: status.platform });
      }
    }
    return map;
  }, [data]);

  const isPlatformInstalled = useCallback(
    (platformId: PlatformId): boolean => byPlatformId.get(platformId)?.installed ?? false,
    [byPlatformId],
  );

  return {
    statuses: data,
    byPlatformId,
    isPlatformInstalled,
    error,
    isLoading,
    isRefreshing,
    refetch,
  };
}

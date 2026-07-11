"use client";

import { useMemo } from "react";

import { useIpcQuery } from "@/lib/ipc/hooks";
import { isPlatformId, type PlatformId } from "@/lib/platforms";

export type UseProjectPlatformsResult = {
  platformIds: PlatformId[];
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
};

export function useProjectPlatforms(projectId: string | null): UseProjectPlatformsResult {
  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<string[]>(
    `project-platforms:${projectId ?? "none"}`,
    (client) => client.listProjectPlatforms(projectId as string),
    { enabled: projectId != null },
  );

  const platformIds = useMemo(
    () =>
      (data ?? [])
        .filter((id): id is PlatformId => isPlatformId(id)),
    [data],
  );

  return {
    platformIds,
    error,
    isLoading,
    isRefreshing,
    refetch,
  };
}

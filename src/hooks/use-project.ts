"use client";

import { useCallback } from "react";

import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type { ProjectSummary } from "@/lib/ipc/types";

type ProjectData = {
  projects: ProjectSummary[];
  activeProjectId: string | null;
};

export type UseProjectResult = {
  projects: ProjectSummary[] | undefined;
  activeProjectId: string | null | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
  setActiveProject: (projectId: string) => Promise<void>;
  isSettingActive: boolean;
  setActiveError: Error | null;
};

export function useProject(): UseProjectResult {
  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<ProjectData>(
    "project",
    async (client) => {
      const [projects, activeProjectId] = await Promise.all([
        client.listProjectSummaries(),
        client.getActiveProjectId(),
      ]);
      return { projects, activeProjectId };
    },
    { pollIntervalMs: DEFAULT_IPC_POLL_INTERVAL_MS },
  );

  const {
    mutateAsync: setActiveProjectId,
    isPending: isSettingActive,
    error: setActiveError,
  } = useIpcMutation(async (client, projectId: string) => {
    await client.setActiveProjectId(projectId);
  });

  const setActiveProject = useCallback(
    async (projectId: string): Promise<void> => {
      await setActiveProjectId(projectId);
      await refetch();
    },
    [refetch, setActiveProjectId],
  );

  return {
    projects: data?.projects,
    activeProjectId: data?.activeProjectId,
    error,
    isLoading,
    isRefreshing,
    refetch,
    setActiveProject,
    isSettingActive,
    setActiveError,
  };
}

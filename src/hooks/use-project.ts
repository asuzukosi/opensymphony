"use client";

import { useCallback } from "react";

import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type { CreateProjectInput } from "@/lib/create-project-form";
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
  createProject: (input: CreateProjectInput) => Promise<void>;
  renameProject: (projectId: string, name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  isSettingActive: boolean;
  isMutatingProject: boolean;
  setActiveError: Error | null;
  projectMutationError: Error | null;
  resetProjectMutation: () => void;
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

  const {
    mutateAsync: mutateProject,
    isPending: isMutatingProject,
    error: projectMutationError,
    reset: resetProjectMutation,
  } = useIpcMutation(
    async (
      client,
      input:
        | { action: "create"; input: CreateProjectInput }
        | { action: "rename"; projectId: string; name: string }
        | { action: "delete"; projectId: string },
    ) => {
      switch (input.action) {
        case "create": {
          const project = await client.createProject(input.input.name);
          await client.setActiveProjectId(project.id);
          return;
        }
        case "rename":
          await client.setProjectName(input.projectId, input.name);
          return;
        case "delete":
          await client.deleteProject(input.projectId);
          return;
      }
    },
  );

  const setActiveProject = useCallback(
    async (projectId: string): Promise<void> => {
      await setActiveProjectId(projectId);
      await refetch();
    },
    [refetch, setActiveProjectId],
  );

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<void> => {
      await mutateProject({ action: "create", input });
      await refetch();
    },
    [mutateProject, refetch],
  );

  const renameProject = useCallback(
    async (projectId: string, name: string): Promise<void> => {
      await mutateProject({ action: "rename", projectId, name });
      await refetch();
    },
    [mutateProject, refetch],
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<void> => {
      await mutateProject({ action: "delete", projectId });
      await refetch();
    },
    [mutateProject, refetch],
  );

  return {
    projects: data?.projects,
    activeProjectId: data?.activeProjectId,
    error,
    isLoading,
    isRefreshing,
    refetch,
    setActiveProject,
    createProject,
    renameProject,
    deleteProject,
    isSettingActive,
    isMutatingProject,
    setActiveError,
    projectMutationError,
    resetProjectMutation,
  };
}

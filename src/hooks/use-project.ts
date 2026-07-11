"use client";

import { useCallback, useEffect, useState } from "react";

import {
  readStoredActiveProjectId,
  resolveActiveProjectId,
  writeStoredActiveProjectId,
} from "@/lib/active-project-storage";
import type { CreateProjectInput } from "@/lib/create-project-form";
import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type { ProjectSummary } from "@/lib/ipc/types";

export type UseProjectResult = {
  projects: ProjectSummary[] | undefined;
  activeProjectId: string | null | undefined;
  error: Error | null;
  isLoading: boolean;
  setActiveProject: (projectId: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<void>;
  renameProject: (projectId: string, name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  isMutatingProject: boolean;
  projectMutationError: Error | null;
  resetProjectMutation: () => void;
};

export function useProject(): UseProjectResult {
  const [activeProjectId, setActiveProjectIdState] = useState<string | null | undefined>(undefined);

  const { data: projects, error, isLoading, refetch } = useIpcQuery<
    ProjectSummary[]
  >(
    "projects",
    async (client) => client.listProjectSummaries(),
    { pollIntervalMs: DEFAULT_IPC_POLL_INTERVAL_MS },
  );

  useEffect(() => {
    if (projects == null) {
      return;
    }

    const resolved = resolveActiveProjectId(projects, readStoredActiveProjectId());
    writeStoredActiveProjectId(resolved);
    setActiveProjectIdState(resolved);
  }, [projects]);

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
          const project = await client.createProject(input.input);
          writeStoredActiveProjectId(project.id);
          setActiveProjectIdState(project.id);
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

  const setActiveProject = useCallback(async (projectId: string): Promise<void> => {
    writeStoredActiveProjectId(projectId);
    setActiveProjectIdState(projectId);
  }, []);

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
      const nextProjects = projects?.filter((project) => project.id !== projectId) ?? [];
      const shouldReassignActive = activeProjectId === projectId;
      const nextActive = shouldReassignActive
        ? resolveActiveProjectId(nextProjects, readStoredActiveProjectId())
        : (activeProjectId ?? null);

      await mutateProject({ action: "delete", projectId });
      await refetch();

      if (shouldReassignActive) {
        writeStoredActiveProjectId(nextActive);
        setActiveProjectIdState(nextActive);
      }
    },
    [activeProjectId, mutateProject, projects, refetch],
  );

  return {
    projects,
    activeProjectId,
    error,
    isLoading: isLoading || activeProjectId === undefined,
    setActiveProject,
    createProject,
    renameProject,
    deleteProject,
    isMutatingProject,
    projectMutationError,
    resetProjectMutation,
  };
}

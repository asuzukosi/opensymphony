"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useProject } from "@/hooks/use-project";
import type { CreateProjectInput } from "@/lib/create-project-form";
import type { ProjectSummary } from "@/lib/ipc/types";

type ActiveProjectContextValue = {
  projectId: string | null | undefined;
  setProjectId: (projectId: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<void>;
  renameProject: (projectId: string, name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  isLoading: boolean;
  projects: ProjectSummary[] | undefined;
  isMutatingProject: boolean;
  projectMutationError: Error | null;
  resetProjectMutation: () => void;
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

type ActiveProjectProviderProps = {
  children: ReactNode;
};

export function ActiveProjectProvider({ children }: ActiveProjectProviderProps) {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    createProject,
    renameProject,
    deleteProject,
    isLoading,
    isMutatingProject,
    projectMutationError,
    resetProjectMutation,
  } = useProject();

  const value = useMemo(
    (): ActiveProjectContextValue => ({
      projectId: activeProjectId,
      setProjectId: setActiveProject,
      createProject,
      renameProject,
      deleteProject,
      isLoading,
      projects,
      isMutatingProject,
      projectMutationError,
      resetProjectMutation,
    }),
    [
      activeProjectId,
      createProject,
      deleteProject,
      isLoading,
      isMutatingProject,
      projectMutationError,
      projects,
      renameProject,
      resetProjectMutation,
      setActiveProject,
    ],
  );

  return (
    <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>
  );
}

export function useActiveProject(): ActiveProjectContextValue {
  const context = useContext(ActiveProjectContext);
  if (!context) {
    throw new Error("useActiveProject must be used within ActiveProjectProvider");
  }
  return context;
}

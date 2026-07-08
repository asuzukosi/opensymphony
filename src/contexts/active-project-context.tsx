"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useProject } from "@/hooks/use-project";
import type { ProjectSummary } from "@/lib/ipc/types";

type ActiveProjectContextValue = {
  projectId: string | null | undefined;
  setProjectId: (projectId: string) => Promise<void>;
  isLoading: boolean;
  projects: ProjectSummary[] | undefined;
  isSettingActive: boolean;
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

type ActiveProjectProviderProps = {
  children: ReactNode;
};

export function ActiveProjectProvider({ children }: ActiveProjectProviderProps) {
  const { projects, activeProjectId, setActiveProject, isLoading, isSettingActive } =
    useProject();

  const value = useMemo(
    (): ActiveProjectContextValue => ({
      projectId: activeProjectId,
      setProjectId: setActiveProject,
      isLoading,
      projects,
      isSettingActive,
    }),
    [activeProjectId, isLoading, isSettingActive, projects, setActiveProject],
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

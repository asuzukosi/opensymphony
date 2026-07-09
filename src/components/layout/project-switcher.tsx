"use client";

import { useState } from "react";
import { ProjectFormDialog } from "@/components/layout/project-form-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  FolderIcon,
  PlusIcon,
} from "@/components/ui/hero-icons";
import { useActiveProject } from "@/contexts/active-project-context";
import { cn } from "@/lib/utils";

export function ProjectSwitcher() {
  const {
    projects,
    projectId,
    isLoading,
    setProjectId,
    createProject,
    renameProject,
    deleteProject,
    isSettingActive,
    isMutatingProject,
    projectMutationError,
    resetProjectMutation,
  } = useActiveProject();

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);

  const activeProject = projects?.find((project) => project.id === projectId);
  const label = isLoading ? "Loading projects..." : (activeProject?.name ?? "Select project");
  const dialogOpen = dialogMode != null;
  const isPending = isSettingActive || isMutatingProject;

  const closeDialog = (): void => {
    setDialogMode(null);
    resetProjectMutation();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || isPending}
            className="h-9 w-full justify-between gap-2 border-sidebar-border bg-sidebar px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FolderIcon />
              <span className="truncate text-left">{label}</span>
            </span>
            <ChevronsUpDownIcon className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!isLoading && projects?.length === 0 ? (
            <DropdownMenuItem disabled>No projects</DropdownMenuItem>
          ) : null}
          {projects?.map((project) => {
            const isActive = project.id === projectId;

            return (
              <DropdownMenuItem
                key={project.id}
                disabled={isPending}
                onSelect={() => void setProjectId(project.id)}
              >
                <span className="truncate">{project.name}</span>
                <CheckIcon className={cn("ml-auto h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isPending}
            onSelect={() => {
              resetProjectMutation();
              setDialogMode("create");
            }}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            New project
          </DropdownMenuItem>
          {activeProject ? (
            <DropdownMenuItem
              disabled={isPending}
              onSelect={() => {
                resetProjectMutation();
                setDialogMode("edit");
              }}
            >
              Edit project
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          }
        }}
        mode={dialogMode === "edit" ? "edit" : "create"}
        initialName={dialogMode === "edit" ? (activeProject?.name ?? "") : ""}
        isPending={isMutatingProject}
        submitError={projectMutationError}
        onCreate={createProject}
        onUpdate={
          activeProject
            ? async (name) => {
                await renameProject(activeProject.id, name);
              }
            : undefined
        }
        onDelete={
          activeProject
            ? async () => {
                await deleteProject(activeProject.id);
              }
            : undefined
        }
      />
    </>
  );
}

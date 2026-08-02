"use client";

import { useMemo, useState } from "react";

import { ProjectFormDialog } from "@/components/project/project-form-dialog";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/hero-icons";
import { useActiveProject } from "@/contexts/active-project-context";

type ProjectOption = {
  id: string;
  value: string;
  name: string;
};

export function ProjectSwitcher() {
  const {
    projects,
    projectId,
    isLoading,
    setProjectId,
    createProject,
    renameProject,
    deleteProject,
    isMutatingProject,
    projectMutationError,
    resetProjectMutation,
  } = useActiveProject();

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);

  const activeProject = projects?.find((project) => project.id === projectId);
  const dialogOpen = dialogMode != null;
  const isPending = isMutatingProject;

  const items = useMemo<ProjectOption[]>(
    () =>
      (projects ?? []).map((project) => ({
        id: project.id,
        value: project.name,
        name: project.name,
      })),
    [projects],
  );

  const closeDialog = (): void => {
    setDialogMode(null);
    resetProjectMutation();
  };

  return (
    <div className="space-y-2">
      <Autocomplete
        items={items}
        value={activeProject?.name ?? ""}
        disabled={isLoading || isPending}
        onValueChange={(next) => {
          const match = items.find((item) => item.value === next || item.name === next);
          if (match) {
            void setProjectId(match.id);
          }
        }}
      >
        <AutocompleteInput
          placeholder={isLoading ? "Loading projects..." : "Select project"}
          className="h-9 border-sidebar-border bg-sidebar"
        />
        <AutocompleteContent>
          <AutocompleteEmpty>No projects found.</AutocompleteEmpty>
          <AutocompleteList>
            {(item) => (
              <AutocompleteItem key={item.id} value={item.value}>
                {item.name}
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 flex-1"
          disabled={isPending}
          onClick={() => {
            resetProjectMutation();
            setDialogMode("create");
          }}
        >
          <PlusIcon className="size-3.5" />
          New
        </Button>
        {activeProject ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={isPending}
            onClick={() => {
              resetProjectMutation();
              setDialogMode("edit");
            }}
          >
            Edit
          </Button>
        ) : null}
      </div>

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
    </div>
  );
}

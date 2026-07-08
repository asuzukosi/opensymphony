"use client";

import { Check, ChevronsUpDown, FolderKanban } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveProject } from "@/contexts/active-project-context";
import { cn } from "@/lib/utils";

export function ProjectSwitcher() {
  const { projects, projectId, isLoading, setProjectId, isSettingActive } = useActiveProject();

  const activeProject = projects?.find((project) => project.id === projectId);
  const label = isLoading ? "Loading projects..." : (activeProject?.name ?? "Select project");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || isSettingActive}
          className="h-9 w-full justify-between gap-2 border-sidebar-border bg-sidebar px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <span className="flex min-w-0 items-center gap-2">
            <FolderKanban className="h-4 w-4 shrink-0" />
            <span className="truncate text-left">{label}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
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
              disabled={isSettingActive}
              onSelect={() => void setProjectId(project.id)}
            >
              <span className="truncate">{project.name}</span>
              <Check className={cn("ml-auto h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

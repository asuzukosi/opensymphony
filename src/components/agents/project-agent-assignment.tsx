"use client";

import { Link2 } from "lucide-react";

import { SurfaceCard } from "@/components/layout/surface-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgentSummary } from "@/lib/ipc/types";

type ProjectAgentAssignmentProps = {
  projectName?: string | null;
  agents?: AgentSummary[];
  projectAgentIds?: string[];
  isLoading?: boolean;
  isPending?: boolean;
  pendingAgentId?: string | null;
  assignmentError?: Error | null;
  onAssign: (agentId: string) => Promise<void>;
  onUnassign: (agentId: string) => Promise<void>;
};

function AssignmentSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

function AssignmentEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-8 text-center">
      <p className="text-sm font-medium">No agents to assign</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add agents to the registry before linking them to a project.
      </p>
    </div>
  );
}

export function ProjectAgentAssignment({
  projectName,
  agents,
  projectAgentIds = [],
  isLoading = false,
  isPending = false,
  pendingAgentId = null,
  assignmentError = null,
  onAssign,
  onUnassign,
}: ProjectAgentAssignmentProps) {
  const assignedIds = new Set(projectAgentIds);
  const hasProject = projectName != null;

  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Project assignment</CardTitle>
        <CardDescription>
          {hasProject
            ? `Choose which agents are linked to ${projectName}.`
            : "Select an active project to manage agent assignments."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasProject ? (
          <Alert>
            <AlertTitle>No active project</AlertTitle>
            <AlertDescription>
              Use the project switcher to select a project before assigning agents.
            </AlertDescription>
          </Alert>
        ) : null}

        {assignmentError ? (
          <Alert variant="destructive">
            <AlertTitle>Assignment update failed</AlertTitle>
            <AlertDescription>{assignmentError.message}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading && agents === undefined ? (
          <AssignmentSkeleton />
        ) : !agents || agents.length === 0 ? (
          <AssignmentEmptyState />
        ) : (
          <ul className="space-y-2">
            {agents.map((agent) => {
              const isAssigned = assignedIds.has(agent.id);
              const isAgentPending = isPending && pendingAgentId === agent.id;

              return (
                <li
                  key={agent.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{agent.name}</p>
                      {isAssigned ? (
                        <Badge variant="secondary" className="font-normal">
                          Assigned
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground" title={agent.id}>
                      {agent.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {isAssigned ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!hasProject || isPending}
                        onClick={() => void onUnassign(agent.id)}
                      >
                        {isAgentPending ? "Removing..." : "Unassign"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={!hasProject || isPending}
                        onClick={() => void onAssign(agent.id)}
                      >
                        <Link2 className="mr-2 h-3.5 w-3.5" />
                        {isAgentPending ? "Assigning..." : "Assign"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </SurfaceCard>
  );
}

"use client";

import { Bot, Plus } from "lucide-react";
import { useState } from "react";

import {
  AgentFormDialog,
  type AgentFormInput,
} from "@/components/agents/agent-form-dialog";
import { AgentsTable } from "@/components/agents/agents-table";
import { ProjectAgentAssignment } from "@/components/agents/project-agent-assignment";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { SurfaceCard } from "@/components/layout/surface-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgents } from "@/hooks/use-agents";
import { useActiveProject } from "@/contexts/active-project-context";
import type { AgentSummary } from "@/lib/ipc/types";

function AgentsLoadingState() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Registry"
        icon={Bot}
        title="Agents"
        description="Manage agent definitions and project assignments."
        isLoading
      />
      <SurfaceCard>
        <CardContent className="py-6">
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </CardContent>
      </SurfaceCard>
    </PageShell>
  );
}

export default function AgentsPage() {
  const { projectId, projects } = useActiveProject();
  const activeProject = projects?.find((project) => project.id === projectId);
  const {
    agents,
    projectAgentIds,
    error,
    isLoading,
    fetchAgent,
    createAgent,
    setAgentName,
    setAgentAcpCommand,
    deleteAgent,
    assignAgentToProject,
    unassignAgentFromProject,
    isMutating,
    mutationError,
    resetMutation,
  } = useAgents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [failedMutation, setFailedMutation] = useState(false);
  const [failedAssignment, setFailedAssignment] = useState(false);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);

  const isInitialLoading = isLoading && agents === undefined;

  const openCreateDialog = (): void => {
    resetMutation();
    setFailedMutation(false);
    setDialogMode("create");
    setSelectedAgentId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (agent: AgentSummary): void => {
    resetMutation();
    setFailedMutation(false);
    setDialogMode("edit");
    setSelectedAgentId(agent.id);
    setDialogOpen(true);
  };

  const handleCreate = async (input: AgentFormInput): Promise<void> => {
    try {
      await createAgent(input.name, input.acpCommand);
    } catch {
      setFailedMutation(true);
    }
  };

  const handleUpdate = async (agentId: string, input: AgentFormInput): Promise<void> => {
    try {
      await setAgentName(agentId, input.name);
      await setAgentAcpCommand(agentId, input.acpCommand);
    } catch {
      setFailedMutation(true);
    }
  };

  const handleDelete = async (agentId: string): Promise<void> => {
    try {
      await deleteAgent(agentId);
    } catch {
      setFailedMutation(true);
    }
  };

  const handleAssign = async (agentId: string): Promise<void> => {
    resetMutation();
    setFailedAssignment(false);
    setFailedMutation(false);
    setPendingAgentId(agentId);

    try {
      await assignAgentToProject(agentId);
    } catch {
      setFailedAssignment(true);
    } finally {
      setPendingAgentId(null);
    }
  };

  const handleUnassign = async (agentId: string): Promise<void> => {
    resetMutation();
    setFailedAssignment(false);
    setFailedMutation(false);
    setPendingAgentId(agentId);

    try {
      await unassignAgentFromProject(agentId);
    } catch {
      setFailedAssignment(true);
    } finally {
      setPendingAgentId(null);
    }
  };

  if (isInitialLoading) {
    return <AgentsLoadingState />;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Registry"
        icon={Bot}
        title="Agents"
        description="Manage agent definitions and project assignments."
        actions={
          <Button type="button" size="sm" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add agent
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Agents unavailable</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-section xl:grid-cols-2">
        <AgentsTable
          agents={agents}
          projectAgentIds={projectAgentIds}
          isLoading={isLoading}
          onAddAgent={openCreateDialog}
          onEdit={openEditDialog}
        />
        <ProjectAgentAssignment
          projectName={activeProject?.name ?? null}
          agents={agents}
          projectAgentIds={projectAgentIds}
          isLoading={isLoading}
          isPending={isMutating}
          pendingAgentId={pendingAgentId}
          assignmentError={failedAssignment ? mutationError : null}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
        />
      </div>

      <AgentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        agentId={selectedAgentId}
        onFetchAgent={fetchAgent}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        isPending={isMutating}
        submitError={failedMutation ? mutationError : null}
      />
    </PageShell>
  );
}

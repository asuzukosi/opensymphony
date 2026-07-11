"use client";

import { EmptyState } from "@/components/layout/empty-state";
import { SurfaceCard } from "@/components/layout/surface-card";
import { AgentsIcon } from "@/components/ui/hero-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgentSummary } from "@/lib/ipc/types";

type AgentsTableProps = {
  agents?: AgentSummary[];
  projectAgentIds?: string[];
  isLoading?: boolean;
  onAddAgent?: () => void;
  onEdit?: (agent: AgentSummary) => void;
};

function truncateAgentId(agentId: string): string {
  if (agentId.length <= 16) {
    return agentId;
  }
  return `${agentId.slice(0, 8)}...${agentId.slice(-4)}`;
}

function AgentsTableSkeleton({ showActions = false }: { showActions?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead>Agent ID</TableHead>
          <TableHead>Assigned</TableHead>
          {showActions ? <TableHead className="w-[100px]">Actions</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 4 }, (_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16 rounded-full" />
            </TableCell>
            {showActions ? (
              <TableCell>
                <Skeleton className="h-8 w-16" />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AgentsTable({
  agents,
  projectAgentIds = [],
  isLoading = false,
  onAddAgent,
  onEdit,
}: AgentsTableProps) {
  if (isLoading && agents === undefined) {
    return (
      <SurfaceCard>
        <AgentsTableSkeleton showActions={onEdit != null} />
      </SurfaceCard>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <SurfaceCard>
        <EmptyState
          icon={AgentsIcon}
          title="No agents registered"
          description="Agent definitions will appear here once you add them to the registry."
          className="py-12"
          action={
            onAddAgent ? (
              <Button type="button" size="sm" onClick={onAddAgent}>
                Add agent
              </Button>
            ) : undefined
          }
        />
      </SurfaceCard>
    );
  }

  const assignedIds = new Set(projectAgentIds);

  return (
    <SurfaceCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Agent ID</TableHead>
            <TableHead>Assigned</TableHead>
            {onEdit ? <TableHead className="w-[100px]">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => {
            const isAssigned = assignedIds.has(agent.id);

            return (
              <TableRow key={agent.id} className="hover:bg-muted/20">
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground" title={agent.id}>
                    {truncateAgentId(agent.id)}
                  </span>
                </TableCell>
                <TableCell>
                  {isAssigned ? (
                    <Badge variant="secondary" className="font-normal">
                      Active project
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                {onEdit ? (
                  <TableCell>
                    <Button type="button" size="sm" variant="outline" onClick={() => onEdit(agent)}>
                      Edit
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SurfaceCard>
  );
}

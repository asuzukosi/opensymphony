import React from "react";
import { Activity, Bot, Clock, Inbox, type LucideIcon } from "lucide-react";
import { CardContent, Skeleton } from "@symphony/ui";
import { cn } from "@symphony/ui";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import type { RuntimeAgentTotals, RuntimeStateCounts } from "@/ipc";

type DashboardMetricsProps = {
  counts?: RuntimeStateCounts;
  agentTotals?: RuntimeAgentTotals;
  isLoading?: boolean;
};

type MetricCardProps = {
  title: string;
  value: number;
  description: string;
  icon: LucideIcon;
  accentClassName: string;
};

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  accentClassName,
}: MetricCardProps): React.JSX.Element {
  return (
    <SurfaceCard className="overflow-hidden transition-colors hover:border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/50",
              accentClassName,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

function MetricCardSkeleton(): React.JSX.Element {
  return (
    <SurfaceCard>
      <CardContent className="space-y-3 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </SurfaceCard>
  );
}

function formatActiveSessionDescription(agentTotals: RuntimeAgentTotals): string {
  const parts: string[] = [];
  if (agentTotals.mockAcp > 0) {
    parts.push(`Mock ${agentTotals.mockAcp}`);
  }
  if (agentTotals.acpCli > 0) {
    parts.push(`CLI ${agentTotals.acpCli}`);
  }
  if (parts.length === 0) {
    return "No active agent sessions";
  }
  return parts.join(" · ");
}

export function DashboardMetrics({
  counts,
  agentTotals,
  isLoading = false,
}: DashboardMetricsProps): React.JSX.Element | null {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <MetricCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!counts || !agentTotals) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Running"
        value={counts.running}
        description="Run attempts in progress"
        icon={Activity}
        accentClassName="bg-emerald-500/10 text-emerald-400"
      />
      <MetricCard
        title="Retrying"
        value={counts.retrying}
        description="Issues waiting for retry"
        icon={Clock}
        accentClassName="bg-amber-500/10 text-amber-400"
      />
      <MetricCard
        title="Candidates"
        value={counts.candidates}
        description="Issues eligible for dispatch"
        icon={Inbox}
        accentClassName="bg-sky-500/10 text-sky-400"
      />
      <MetricCard
        title="Active Sessions"
        value={agentTotals.activeSessions}
        description={formatActiveSessionDescription(agentTotals)}
        icon={Bot}
        accentClassName="bg-violet-500/10 text-violet-400"
      />
    </div>
  );
}

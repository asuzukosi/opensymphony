"use client";

import { Activity, CircleDot, Clock, Inbox } from "lucide-react";

import { StatCard } from "@/components/layout/stat-card";
import { isPendingLoad } from "@/lib/is-pending-load";
import type {
  RuntimeCandidateEntry,
  RuntimeRetryEntry,
  RuntimeRunningEntry,
  RuntimeSummary,
} from "@/lib/ipc/types";
import { capitalize } from "@/lib/utils";

type StatCardsProps = {
  summary?: RuntimeSummary;
  running?: RuntimeRunningEntry[];
  retrying?: RuntimeRetryEntry[];
  candidates?: RuntimeCandidateEntry[];
  isLoading?: boolean;
};

export function StatCards({ summary, running, retrying, candidates, isLoading = false }: StatCardsProps) {
  const pending = isPendingLoad(isLoading, summary);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Status"
        value={summary?.status ? capitalize(summary.status) : "—"}
        description="Orchestrator lifecycle state"
        icon={CircleDot}
        iconClassName="bg-primary/10 text-primary"
        isLoading={pending}
      />
      <StatCard
        title="Running"
        value={pending ? 0 : (running?.length ?? "—")}
        description="Run attempts in progress"
        icon={Activity}
        iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        isLoading={pending}
      />
      <StatCard
        title="Retrying"
        value={pending ? 0 : (retrying?.length ?? "—")}
        description="Issues waiting for retry"
        icon={Clock}
        iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        isLoading={pending}
      />
      <StatCard
        title="Candidates"
        value={pending ? 0 : (candidates?.length ?? "—")}
        description="Issues eligible for dispatch"
        icon={Inbox}
        iconClassName="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        isLoading={pending}
      />
    </div>
  );
}

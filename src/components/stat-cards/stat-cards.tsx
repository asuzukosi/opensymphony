"use client";

import { CandidatesStatCard } from "@/components/stat-cards/candidates-stat-card";
import { RetryStatCard } from "@/components/stat-cards/retry-stat-card";
import { RunningStatCard } from "@/components/stat-cards/running-stat-card";
import { StatusStatCard } from "@/components/stat-cards/status-stat-card";
import { isPendingLoad } from "@/lib/is-pending-load";
import type {
  RuntimeCandidateEntry,
  RuntimeRetryEntry,
  RuntimeRunningEntry,
  RuntimeSummary,
} from "@/lib/ipc/types";

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
      <StatusStatCard status={summary?.status} isLoading={pending} />
      <RunningStatCard count={running?.length ?? 0} isLoading={pending} />
      <RetryStatCard count={retrying?.length ?? 0} isLoading={pending} />
      <CandidatesStatCard count={candidates?.length ?? 0} isLoading={pending} />
    </div>
  );
}

"use client";

import { ExclamationCircleIcon } from "@/components/ui/hero-icons";
import { useEffect, useState } from "react";

import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { AuditPanel } from "@/components/dashboard/audit-panel";
import { FinishedPanel } from "@/components/dashboard/finished-panel";
import { RetryPanel } from "@/components/dashboard/retry-panel";
import { RunningPanel } from "@/components/dashboard/running-panel";
import { RuntimePanel } from "@/components/dashboard/runtime-panel";
import { StatCards } from "@/components/stat-cards/stat-cards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useActiveProject } from "@/contexts/active-project-context";
import { useAgentActivity } from "@/hooks/use-agent-activity";
import { useRuntime } from "@/hooks/use-runtime";
import { createDefaultActivityTimeRange } from "@/lib/activity-time-range";
import type { ActivityTimeRange } from "@/lib/ipc/types";

export function DashboardPageContent() {
  const { projectId: activeProjectId, projects } = useActiveProject();
  const runtime = useRuntime({
    projectId: activeProjectId ?? null,
    enabled: activeProjectId != null,
  });
  const [timeRange, setTimeRange] = useState<ActivityTimeRange | null>(null);
  const [activityProjectFilter, setActivityProjectFilter] = useState<string | null>(null);
  const activity = useAgentActivity(timeRange, { projectId: activityProjectFilter });

  useEffect(() => {
    setTimeRange(createDefaultActivityTimeRange());
  }, []);

  const runtimeControlsEnabled = activeProjectId != null;

  const errors = [
    runtime.error ? { title: "Runtime data unavailable", message: runtime.error.message } : null,
    activity.error ? { title: "Activity data unavailable", message: activity.error.message } : null,
  ].filter((item): item is { title: string; message: string } => item != null);

  return (
    <div className="flex flex-col gap-section">
      {errors.length > 0 ? (
        <div className="space-y-3">
          {errors.map((item) => (
            <Alert key={item.title} variant="destructive">
              <ExclamationCircleIcon className="h-4 w-4" />
              <AlertTitle>{item.title}</AlertTitle>
              <AlertDescription>{item.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}

      <section aria-label="Key metrics">
        <StatCards
          summary={runtime.summary}
          running={runtime.running}
          retrying={runtime.retrying}
          candidates={runtime.candidates}
          isLoading={runtime.isLoading}
        />
      </section>

      <section aria-label="Runtime overview" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <RuntimePanel projectId={activeProjectId ?? null} runtime={runtime} />
        <RunningPanel
          running={runtime.running}
          isLoading={runtime.isLoading}
          onPauseRun={runtimeControlsEnabled ? runtime.pauseRun : undefined}
          onResumeRun={runtimeControlsEnabled ? runtime.resumeRun : undefined}
          onCancelRun={runtimeControlsEnabled ? runtime.cancelRun : undefined}
          isControlling={runtime.isControlling}
        />
        <div className="min-w-0 lg:col-span-2 xl:col-span-1">
          <RetryPanel retrying={runtime.retrying} isLoading={runtime.isLoading} />
        </div>
      </section>

      <section aria-label="Activity charts">
        <ActivityPanel
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          agentBuckets={activity.agentActivity}
          isLoading={activity.isLoading}
          showProjectBreakdown={activityProjectFilter == null}
          projects={projects}
          projectFilter={activityProjectFilter}
          onProjectFilterChange={setActivityProjectFilter}
        />
      </section>

      <section aria-label="Recent activity" className="grid gap-4 xl:grid-cols-2">
        <FinishedPanel recentFinished={runtime.recentFinished} isLoading={runtime.isLoading} />
        <AuditPanel recentEvents={runtime.recentEvents} isLoading={runtime.isLoading} />
      </section>
    </div>
  );
}

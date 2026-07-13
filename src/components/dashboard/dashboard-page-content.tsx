"use client";

import { ExclamationCircleIcon } from "@/components/ui/hero-icons";
import { useEffect, useState } from "react";

import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { FinishedPanel } from "@/components/dashboard/finished-panel";
import { RetryPanel } from "@/components/dashboard/retry-panel";
import { RunningPanel } from "@/components/dashboard/running-panel";
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
    runtime.error ? { title: "Session data unavailable", message: runtime.error.message } : null,
    activity.error ? { title: "Activity data unavailable", message: activity.error.message } : null,
  ].filter((item): item is { title: string; message: string } => item != null);

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 ? (
        <div className="space-y-2">
          {errors.map((item) => (
            <Alert key={item.title} variant="destructive" className="text-xs">
              <ExclamationCircleIcon className="h-4 w-4" />
              <AlertTitle>{item.title}</AlertTitle>
              <AlertDescription>{item.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}

      <section aria-label="Active work" className="grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="min-w-0">
          <RunningPanel
            running={runtime.running}
            isLoading={runtime.isLoading}
            onPauseRun={runtimeControlsEnabled ? runtime.pauseRun : undefined}
            onResumeRun={runtimeControlsEnabled ? runtime.resumeRun : undefined}
            onCancelRun={runtimeControlsEnabled ? runtime.cancelRun : undefined}
            isControlling={runtime.isControlling}
          />
        </div>
        <div className="min-w-0">
          <RetryPanel retrying={runtime.retrying} isLoading={runtime.isLoading} />
        </div>
      </section>

      <section aria-label="Activity charts" className="space-y-3">
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

      <section aria-label="Recent activity">
        <FinishedPanel recentFinished={runtime.recentFinished} isLoading={runtime.isLoading} />
      </section>
    </div>
  );
}

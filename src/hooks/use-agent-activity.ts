"use client";

import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type {
  ActivityTimeRange,
  AgentActivityOverTimeBucket,
} from "@/lib/ipc/types";

export type UseAgentActivityOptions = {
  projectId?: string | null;
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseAgentActivityResult = {
  agentActivity: AgentActivityOverTimeBucket[] | undefined;
  error: Error | null;
  isLoading: boolean;
};

function activityQueryKey(
  projectId: string | null,
  timeRange: ActivityTimeRange,
): string {
  return `agent-activity:${projectId ?? "global"}:${timeRange.startAt}:${timeRange.endAt}:${timeRange.bucketMs}`;
}

export function useAgentActivity(
  timeRange: ActivityTimeRange | null,
  options?: UseAgentActivityOptions,
): UseAgentActivityResult {
  const {
    projectId = null,
    pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS,
    enabled: enabledOption = true,
  } = options ?? {};
  const enabled = enabledOption && timeRange != null;

  const { data, error, isLoading } = useIpcQuery<AgentActivityOverTimeBucket[]>(
    timeRange
      ? activityQueryKey(projectId, timeRange)
      : "agent-activity:pending-time-range",
    async (client) => {
      if (!timeRange) {
        throw new Error("activity time range not ready");
      }
      const response = await client.getAgentActivityOverTime(timeRange, projectId);
      return response.buckets;
    },
    { pollIntervalMs, enabled },
  );

  return {
    agentActivity: data,
    error,
    isLoading: timeRange == null || isLoading,
  };
}

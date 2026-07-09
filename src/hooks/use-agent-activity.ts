"use client";

import { useActiveProject } from "@/contexts/active-project-context";
import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type {
  ActivityTimeRange,
  AgentActivityOverTimeBucket,
  PermissionActivityOverTimeBucket,
} from "@/lib/ipc/types";

type AgentActivityData = {
  agentActivity: AgentActivityOverTimeBucket[];
  permissionActivity: PermissionActivityOverTimeBucket[];
  timeRange: ActivityTimeRange;
  fetchedAt: string;
};

export type UseAgentActivityOptions = {
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseAgentActivityResult = {
  agentActivity: AgentActivityOverTimeBucket[] | undefined;
  permissionActivity: PermissionActivityOverTimeBucket[] | undefined;
  timeRange: ActivityTimeRange | null;
  fetchedAt: string | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
};

function activityQueryKey(projectId: string, timeRange: ActivityTimeRange): string {
  return `agent-activity:${projectId}:${timeRange.startAt}:${timeRange.endAt}:${timeRange.bucketMs}`;
}

export function useAgentActivity(
  timeRange: ActivityTimeRange | null,
  options?: UseAgentActivityOptions,
): UseAgentActivityResult {
  const { pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS, enabled: enabledOption = true } =
    options ?? {};
  const { projectId } = useActiveProject();
  const enabled = enabledOption && projectId != null && timeRange != null;

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<AgentActivityData>(
    timeRange
      ? activityQueryKey(projectId ?? "none", timeRange)
      : "agent-activity:pending-time-range",
    async (client) => {
      if (!timeRange) {
        throw new Error("activity time range not ready");
      }

      const id = projectId as string;
      const [agentResponse, permissionResponse] = await Promise.all([
        client.getProjectAgentActivityOverTime(id, timeRange),
        client.getProjectPermissionActivityOverTime(id, timeRange),
      ]);

      return {
        agentActivity: agentResponse.buckets,
        permissionActivity: permissionResponse.buckets,
        timeRange,
        fetchedAt: new Date().toISOString(),
      };
    },
    { pollIntervalMs, enabled },
  );

  return {
    agentActivity: data?.agentActivity,
    permissionActivity: data?.permissionActivity,
    timeRange: data?.timeRange ?? timeRange,
    fetchedAt: data?.fetchedAt,
    error,
    isLoading: timeRange == null || isLoading,
    isRefreshing,
    refetch,
  };
}

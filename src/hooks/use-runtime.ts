"use client";

import { useCallback } from "react";
import { useActiveProject } from "@/contexts/active-project-context";
import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type {
  RuntimeAuditEvent,
  RuntimeCandidateEntry,
  RuntimeRecentFinishedEntry,
  RuntimeRetryEntry,
  RuntimeRunningEntry,
  RuntimeSummary,
} from "@/lib/ipc/types";
import { requireProjectId } from "@/lib/require-project-id";

type RuntimeData = {
  summary: RuntimeSummary;
  running: RuntimeRunningEntry[];
  retrying: RuntimeRetryEntry[];
  candidates: RuntimeCandidateEntry[];
  recentFinished: RuntimeRecentFinishedEntry[];
  recentEvents: RuntimeAuditEvent[];
  fetchedAt: string;
};

type RuntimeControlInput =
  | { action: "start"; projectId: string }
  | { action: "stop"; projectId: string }
  | { action: "tick"; projectId: string }
  | { action: "setPollInterval"; projectId: string; pollIntervalMs: number }
  | { action: "clearPollIntervalOverride"; projectId: string };

export type UseRuntimeOptions = {
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseRuntimeResult = {
  summary: RuntimeSummary | undefined;
  running: RuntimeRunningEntry[] | undefined;
  retrying: RuntimeRetryEntry[] | undefined;
  candidates: RuntimeCandidateEntry[] | undefined;
  recentFinished: RuntimeRecentFinishedEntry[] | undefined;
  recentEvents: RuntimeAuditEvent[] | undefined;
  fetchedAt: string | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
  startRuntime: () => Promise<void>;
  stopRuntime: () => Promise<void>;
  tickRuntime: () => Promise<void>;
  setRuntimePollInterval: (pollIntervalMs: number) => Promise<void>;
  clearRuntimePollIntervalOverride: () => Promise<void>;
  isControlling: boolean;
  controlError: Error | null;
  resetControl: () => void;
};

export function useRuntime(options?: UseRuntimeOptions): UseRuntimeResult {
  const { pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS, enabled: enabledOption = true } =
    options ?? {};
  const { projectId } = useActiveProject();
  const enabled = enabledOption && projectId != null;

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<RuntimeData>(
    `runtime:${projectId ?? "none"}`,
    async (client) => {
      const id = projectId as string;
      const [summary, running, retrying, candidates, recentFinished, recentEvents] =
        await Promise.all([
          client.getRuntimeSummary(id),
          client.getRuntimeRunning(id),
          client.getRuntimeRetrying(id),
          client.getRuntimeCandidates(id),
          client.getRuntimeRecentFinished(id),
          client.getRuntimeRecentEvents(id),
        ]);

      return {
        summary,
        running,
        retrying,
        candidates,
        recentFinished,
        recentEvents,
        fetchedAt: new Date().toISOString(),
      };
    },
    { pollIntervalMs, enabled },
  );

  const {
    mutateAsync: runControl,
    isPending: isControlling,
    error: controlError,
    reset: resetControl,
  } = useIpcMutation(async (client, input: RuntimeControlInput) => {
    switch (input.action) {
      case "start":
        return client.startRuntime(input.projectId);
      case "stop":
        return client.stopRuntime(input.projectId);
      case "tick":
        return client.tickRuntime(input.projectId);
      case "setPollInterval":
        return client.setRuntimePollInterval(input.projectId, input.pollIntervalMs);
      case "clearPollIntervalOverride":
        return client.clearRuntimePollIntervalOverride(input.projectId);
    }
  });

  const startRuntime = useCallback(async (): Promise<void> => {
    await runControl({ action: "start", projectId: requireProjectId(projectId) });
    await refetch();
  }, [projectId, refetch, runControl]);

  const stopRuntime = useCallback(async (): Promise<void> => {
    await runControl({ action: "stop", projectId: requireProjectId(projectId) });
    await refetch();
  }, [projectId, refetch, runControl]);

  const tickRuntime = useCallback(async (): Promise<void> => {
    await runControl({ action: "tick", projectId: requireProjectId(projectId) });
    await refetch();
  }, [projectId, refetch, runControl]);

  const setRuntimePollInterval = useCallback(
    async (pollIntervalMs: number): Promise<void> => {
      await runControl({
        action: "setPollInterval",
        projectId: requireProjectId(projectId),
        pollIntervalMs,
      });
      await refetch();
    },
    [projectId, refetch, runControl],
  );

  const clearRuntimePollIntervalOverride = useCallback(async (): Promise<void> => {
    await runControl({
      action: "clearPollIntervalOverride",
      projectId: requireProjectId(projectId),
    });
    await refetch();
  }, [projectId, refetch, runControl]);

  return {
    summary: data?.summary,
    running: data?.running,
    retrying: data?.retrying,
    candidates: data?.candidates,
    recentFinished: data?.recentFinished,
    recentEvents: data?.recentEvents,
    fetchedAt: data?.fetchedAt,
    error,
    isLoading,
    isRefreshing,
    refetch,
    startRuntime,
    stopRuntime,
    tickRuntime,
    setRuntimePollInterval,
    clearRuntimePollIntervalOverride,
    isControlling,
    controlError,
    resetControl,
  };
}

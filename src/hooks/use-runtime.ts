"use client";

import { useCallback } from "react";
import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type {
  RuntimeAuditEvent,
  RuntimeRecentFinishedEntry,
  RuntimeRetryEntry,
  RuntimeRunningEntry,
} from "@/lib/ipc/types";
import { requireProjectId } from "@/lib/require-project-id";

type RuntimeActivityData = {
  running: RuntimeRunningEntry[];
  retrying: RuntimeRetryEntry[];
  recentFinished: RuntimeRecentFinishedEntry[];
  recentEvents: RuntimeAuditEvent[];
};

type RuntimeControlInput =
  | { action: "pause"; projectId: string; runAttemptId: string }
  | { action: "resume"; projectId: string; runAttemptId: string }
  | { action: "cancel"; projectId: string; runAttemptId: string };

export type UseRuntimeOptions = {
  projectId?: string | null;
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseRuntimeResult = {
  running: RuntimeRunningEntry[] | undefined;
  retrying: RuntimeRetryEntry[] | undefined;
  recentFinished: RuntimeRecentFinishedEntry[] | undefined;
  recentEvents: RuntimeAuditEvent[] | undefined;
  error: Error | null;
  isLoading: boolean;
  pauseRun: (runAttemptId: string) => Promise<void>;
  resumeRun: (runAttemptId: string) => Promise<void>;
  cancelRun: (runAttemptId: string) => Promise<void>;
  isControlling: boolean;
  controlError: Error | null;
  resetControl: () => void;
};

export function useRuntime(options?: UseRuntimeOptions): UseRuntimeResult {
  const {
    projectId = null,
    pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS,
    enabled: enabledOption = true,
  } = options ?? {};
  const enabled = enabledOption && projectId != null;

  const { data, error, isLoading, refetch } = useIpcQuery<RuntimeActivityData>(
    `runtime-activity:${projectId ?? "none"}`,
    async (client) => {
      const id = projectId as string;
      const [running, retrying, recentFinished, recentEvents] = await Promise.all([
        client.getRuntimeRunning(id),
        client.getRuntimeRetrying(id),
        client.getRuntimeRecentFinished(id),
        client.getRuntimeRecentEvents(id),
      ]);

      return {
        running,
        retrying,
        recentFinished,
        recentEvents,
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
      case "pause":
        return client.pauseRun(input.projectId, input.runAttemptId);
      case "resume":
        return client.resumeRun(input.projectId, input.runAttemptId);
      case "cancel":
        return client.cancelRun(input.projectId, input.runAttemptId);
    }
  });

  const pauseRun = useCallback(
    async (runAttemptId: string): Promise<void> => {
      await runControl({
        action: "pause",
        projectId: requireProjectId(projectId),
        runAttemptId,
      });
      await refetch();
    },
    [projectId, refetch, runControl],
  );

  const resumeRun = useCallback(
    async (runAttemptId: string): Promise<void> => {
      await runControl({
        action: "resume",
        projectId: requireProjectId(projectId),
        runAttemptId,
      });
      await refetch();
    },
    [projectId, refetch, runControl],
  );

  const cancelRun = useCallback(
    async (runAttemptId: string): Promise<void> => {
      await runControl({
        action: "cancel",
        projectId: requireProjectId(projectId),
        runAttemptId,
      });
      await refetch();
    },
    [projectId, refetch, runControl],
  );

  return {
    running: data?.running,
    retrying: data?.retrying,
    recentFinished: data?.recentFinished,
    recentEvents: data?.recentEvents,
    error,
    isLoading,
    pauseRun,
    resumeRun,
    cancelRun,
    isControlling,
    controlError,
    resetControl,
  };
}

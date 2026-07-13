"use client";

import { useIpcMutation, useIpcQuery } from "@/lib/ipc/hooks";
import type {
  RuntimeRecentFinishedEntry,
  RuntimeRetryEntry,
  RuntimeRunningEntry,
} from "@/lib/ipc/types";
import { listenRuntimeEvents } from "@/lib/runtime-events";
import { useCallback, useEffect } from "react";

type RuntimeActivityData = {
  running: RuntimeRunningEntry[];
  retrying: RuntimeRetryEntry[];
  recentFinished: RuntimeRecentFinishedEntry[];
};

type RuntimeControlInput =
  | { action: "pause"; runAttemptId: string }
  | { action: "resume"; runAttemptId: string }
  | { action: "cancel"; runAttemptId: string };

export type UseRuntimeOptions = {
  projectId?: string | null;
  enabled?: boolean;
};

export type UseRuntimeResult = {
  running: RuntimeRunningEntry[] | undefined;
  retrying: RuntimeRetryEntry[] | undefined;
  recentFinished: RuntimeRecentFinishedEntry[] | undefined;
  error: Error | null;
  isLoading: boolean;
  pauseRun: (runAttemptId: string) => Promise<void>;
  resumeRun: (runAttemptId: string) => Promise<void>;
  cancelRun: (runAttemptId: string) => Promise<void>;
  isControlling: boolean;
};

export function useRuntime(options?: UseRuntimeOptions): UseRuntimeResult {
  const { projectId = null, enabled: enabledOption = true } = options ?? {};
  const enabled = enabledOption && projectId != null;

  const { data, error, isLoading, refetch } = useIpcQuery<RuntimeActivityData>(
    `runtime-activity:${projectId ?? "none"}`,
    async (client) => {
      const id = projectId as string;
      const [running, retrying, recentFinished] = await Promise.all([
        client.getRuntimeRunning(id),
        client.getRuntimeRetrying(id),
        client.getRuntimeRecentFinished(id),
      ]);

      return { running, retrying, recentFinished };
    },
    { pollIntervalMs: 0, enabled },
  );

  useEffect(() => {
    if (!enabled || projectId == null) {
      return;
    }

    let unlisten: (() => void) | undefined;

    void listenRuntimeEvents(projectId, {
      onChange: () => {
        void refetch();
      },
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => {
      unlisten?.();
    };
  }, [enabled, projectId, refetch]);

  const { mutateAsync: runControl, isPending: isControlling } = useIpcMutation(
    async (client, input: RuntimeControlInput) => {
      switch (input.action) {
        case "pause":
          return client.pauseRun(input.runAttemptId);
        case "resume":
          return client.resumeRun(input.runAttemptId);
        case "cancel":
          return client.cancelRun(input.runAttemptId);
      }
    },
  );

  const pauseRun = useCallback(
    async (runAttemptId: string): Promise<void> => {
      await runControl({ action: "pause", runAttemptId });
    },
    [runControl],
  );

  const resumeRun = useCallback(
    async (runAttemptId: string): Promise<void> => {
      await runControl({ action: "resume", runAttemptId });
    },
    [runControl],
  );

  const cancelRun = useCallback(
    async (runAttemptId: string): Promise<void> => {
      await runControl({ action: "cancel", runAttemptId });
    },
    [runControl],
  );

  return {
    running: data?.running,
    retrying: data?.retrying,
    recentFinished: data?.recentFinished,
    error,
    isLoading,
    pauseRun,
    resumeRun,
    cancelRun,
    isControlling,
  };
}

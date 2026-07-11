"use client";

import { useCallback } from "react";

import { useActiveProject } from "@/contexts/active-project-context";
import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type {
  RetryPolicy,
  SetProjectMaxConcurrencyResponse,
  SetProjectNameResponse,
  SetProjectPollIntervalResponse,
  SetProjectPromptTemplateResponse,
  SetProjectRetryPolicyResponse,
} from "@/lib/ipc/types";
import { requireProjectId } from "@/lib/require-project-id";

export type ProjectSettings = {
  name: string;
  promptTemplate: string;
  pollIntervalMs: number;
  maxConcurrency: number;
  retryPolicy: RetryPolicy;
  orchestratorStatus: string;
};

type ProjectSettingsWriteInput =
  | { action: "setName"; name: string }
  | { action: "setPromptTemplate"; promptTemplate: string }
  | { action: "setPollInterval"; pollIntervalMs: number }
  | { action: "setMaxConcurrency"; maxConcurrency: number }
  | { action: "setRetryPolicy"; maxAttempts: number; backoffMs: number };

type ProjectSettingsWriteMutationInput = ProjectSettingsWriteInput & {
  projectId: string;
};

export type UseProjectSettingsOptions = {
  projectId?: string | null;
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseProjectSettingsResult = {
  settings: ProjectSettings | undefined;
  error: Error | null;
  isLoading: boolean;
  setName: (name: string) => Promise<void>;
  setPromptTemplate: (promptTemplate: string) => Promise<void>;
  setPollInterval: (pollIntervalMs: number) => Promise<void>;
  setMaxConcurrency: (maxConcurrency: number) => Promise<void>;
  setRetryPolicy: (maxAttempts: number, backoffMs: number) => Promise<void>;
  isMutating: boolean;
  mutationError: Error | null;
  resetMutation: () => void;
};

export function useProjectSettings(
  options?: UseProjectSettingsOptions,
): UseProjectSettingsResult {
  const {
    projectId: projectIdOption,
    pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS,
    enabled: enabledOption = true,
  } = options ?? {};
  const { projectId: activeProjectId } = useActiveProject();
  const projectId = projectIdOption ?? activeProjectId;
  const enabled = enabledOption && projectId != null;

  const { data, error, isLoading, refetch } = useIpcQuery<ProjectSettings>(
    `project-settings:${projectId ?? "none"}`,
    async (client) => {
      const id = projectId as string;
      const [name, promptTemplate, pollIntervalMs, maxConcurrency, retryPolicy, orchestratorStatus] =
        await Promise.all([
          client.getProjectName(id),
          client.getProjectPromptTemplate(id),
          client.getProjectPollInterval(id),
          client.getProjectMaxConcurrency(id),
          client.getProjectRetryPolicy(id),
          client.getProjectOrchestratorStatus(id),
        ]);

      return {
        name,
        promptTemplate,
        pollIntervalMs,
        maxConcurrency,
        retryPolicy,
        orchestratorStatus,
      };
    },
    { pollIntervalMs, enabled },
  );

  const {
    mutateAsync: writeSettings,
    isPending: isMutating,
    error: mutationError,
    reset: resetMutation,
  } = useIpcMutation<
    ProjectSettingsWriteMutationInput,
    | SetProjectNameResponse
    | SetProjectPromptTemplateResponse
    | SetProjectPollIntervalResponse
    | SetProjectMaxConcurrencyResponse
    | SetProjectRetryPolicyResponse
  >(async (client, input) => {
    switch (input.action) {
      case "setName":
        return client.setProjectName(input.projectId, input.name);
      case "setPromptTemplate":
        return client.setProjectPromptTemplate(input.projectId, input.promptTemplate);
      case "setPollInterval":
        return client.setProjectPollInterval(input.projectId, input.pollIntervalMs);
      case "setMaxConcurrency":
        return client.setProjectMaxConcurrency(input.projectId, input.maxConcurrency);
      case "setRetryPolicy":
        return client.setProjectRetryPolicy(
          input.projectId,
          input.maxAttempts,
          input.backoffMs,
        );
    }
  });

  const mutateAndRefetch = useCallback(
    async (input: ProjectSettingsWriteInput): Promise<void> => {
      const id = requireProjectId(projectId);
      await writeSettings({ ...input, projectId: id });
      await refetch();
    },
    [projectId, refetch, writeSettings],
  );

  const setName = useCallback(
    async (name: string): Promise<void> => {
      await mutateAndRefetch({ action: "setName", name });
    },
    [mutateAndRefetch],
  );

  const setPromptTemplate = useCallback(
    async (promptTemplate: string): Promise<void> => {
      await mutateAndRefetch({ action: "setPromptTemplate", promptTemplate });
    },
    [mutateAndRefetch],
  );

  const setPollInterval = useCallback(
    async (pollIntervalMs: number): Promise<void> => {
      await mutateAndRefetch({ action: "setPollInterval", pollIntervalMs });
    },
    [mutateAndRefetch],
  );

  const setMaxConcurrency = useCallback(
    async (maxConcurrency: number): Promise<void> => {
      await mutateAndRefetch({ action: "setMaxConcurrency", maxConcurrency });
    },
    [mutateAndRefetch],
  );

  const setRetryPolicy = useCallback(
    async (maxAttempts: number, backoffMs: number): Promise<void> => {
      await mutateAndRefetch({ action: "setRetryPolicy", maxAttempts, backoffMs });
    },
    [mutateAndRefetch],
  );

  return {
    settings: data,
    error,
    isLoading,
    setName,
    setPromptTemplate,
    setPollInterval,
    setMaxConcurrency,
    setRetryPolicy,
    isMutating,
    mutationError,
    resetMutation,
  };
}

"use client";

import { useCallback } from "react";

import { useActiveProject } from "@/contexts/active-project-context";
import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type {
  PermissionMode,
  RetryPolicy,
  SetProjectMaxConcurrencyResponse,
  SetProjectNameResponse,
  SetProjectPermissionModeResponse,
  SetProjectPollIntervalResponse,
  SetProjectPromptTemplateResponse,
  SetProjectRetryPolicyResponse,
  SetProjectWorkflowFileResponse,
} from "@/lib/ipc/types";
import { requireProjectId } from "@/lib/require-project-id";

export type ProjectSettings = {
  name: string;
  workflowSource: string | null;
  workflowFilePath: string | null;
  workflowVersion: string | null;
  promptTemplate: string;
  pollIntervalMs: number;
  maxConcurrency: number;
  retryPolicy: RetryPolicy;
  permissionMode: PermissionMode;
  orchestratorStatus: string;
};

type ProjectSettingsWriteInput =
  | { action: "setName"; name: string }
  | { action: "setWorkflowFile"; sourcePath: string }
  | { action: "importWorkflowFile"; sourcePath: string }
  | { action: "setPromptTemplate"; promptTemplate: string }
  | { action: "setPollInterval"; pollIntervalMs: number }
  | { action: "setMaxConcurrency"; maxConcurrency: number }
  | { action: "setRetryPolicy"; maxAttempts: number; backoffMs: number }
  | { action: "setPermissionMode"; permissionMode: PermissionMode };

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
  isRefreshing: boolean;
  refetch: () => Promise<void>;
  setName: (name: string) => Promise<void>;
  setWorkflowFile: (sourcePath: string) => Promise<void>;
  importWorkflowFile: (sourcePath: string) => Promise<void>;
  setPromptTemplate: (promptTemplate: string) => Promise<void>;
  setPollInterval: (pollIntervalMs: number) => Promise<void>;
  setMaxConcurrency: (maxConcurrency: number) => Promise<void>;
  setRetryPolicy: (maxAttempts: number, backoffMs: number) => Promise<void>;
  setPermissionMode: (permissionMode: PermissionMode) => Promise<void>;
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

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<ProjectSettings>(
    `project-settings:${projectId ?? "none"}`,
    async (client) => {
      const id = projectId as string;
      const [
        name,
        workflowSource,
        workflowFilePath,
        workflowVersion,
        promptTemplate,
        pollIntervalMs,
        maxConcurrency,
        retryPolicy,
        permissionMode,
        orchestratorStatus,
      ] = await Promise.all([
        client.getProjectName(id),
        client.getProjectWorkflowSource(id),
        client.getProjectWorkflowFilePath(id),
        client.getProjectWorkflowVersion(id),
        client.getProjectPromptTemplate(id),
        client.getProjectPollInterval(id),
        client.getProjectMaxConcurrency(id),
        client.getProjectRetryPolicy(id),
        client.getProjectPermissionMode(id),
        client.getProjectOrchestratorStatus(id),
      ]);

      return {
        name,
        workflowSource,
        workflowFilePath,
        workflowVersion,
        promptTemplate,
        pollIntervalMs,
        maxConcurrency,
        retryPolicy,
        permissionMode,
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
    | SetProjectWorkflowFileResponse
    | SetProjectPromptTemplateResponse
    | SetProjectPollIntervalResponse
    | SetProjectMaxConcurrencyResponse
    | SetProjectRetryPolicyResponse
    | SetProjectPermissionModeResponse
  >(async (client, input) => {
    switch (input.action) {
      case "setName":
        return client.setProjectName(input.projectId, input.name);
      case "setWorkflowFile":
        return client.setProjectWorkflowFile(input.projectId, input.sourcePath);
      case "importWorkflowFile":
        return client.importProjectWorkflowFile(input.projectId, input.sourcePath);
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
      case "setPermissionMode":
        return client.setProjectPermissionMode(input.projectId, input.permissionMode);
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

  const setWorkflowFile = useCallback(
    async (sourcePath: string): Promise<void> => {
      await mutateAndRefetch({ action: "setWorkflowFile", sourcePath });
    },
    [mutateAndRefetch],
  );

  const importWorkflowFile = useCallback(
    async (sourcePath: string): Promise<void> => {
      await mutateAndRefetch({ action: "importWorkflowFile", sourcePath });
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

  const setPermissionMode = useCallback(
    async (permissionMode: PermissionMode): Promise<void> => {
      await mutateAndRefetch({ action: "setPermissionMode", permissionMode });
    },
    [mutateAndRefetch],
  );

  return {
    settings: data,
    error,
    isLoading,
    isRefreshing,
    refetch,
    setName,
    setWorkflowFile,
    importWorkflowFile,
    setPromptTemplate,
    setPollInterval,
    setMaxConcurrency,
    setRetryPolicy,
    setPermissionMode,
    isMutating,
    mutationError,
    resetMutation,
  };
}

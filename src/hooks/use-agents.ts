"use client";

import { useCallback } from "react";

import { useActiveProject } from "@/contexts/active-project-context";
import { getIpcClient, isIpcAvailable, IpcUnavailableError } from "@/lib/ipc/client";
import {
  DEFAULT_IPC_POLL_INTERVAL_MS,
  useIpcMutation,
  useIpcQuery,
} from "@/lib/ipc/hooks";
import type {
  Agent,
  AgentSummary,
  CreateAgentResponse,
  SetAgentAcpCommandResponse,
  SetAgentNameResponse,
} from "@/lib/ipc/types";
import { requireProjectId } from "@/lib/require-project-id";

type AgentsData = {
  agents: AgentSummary[];
  projectAgentIds: string[];
};

type AgentsWriteInput =
  | { action: "create"; name: string; acpCommand?: string | null }
  | { action: "delete"; agentId: string }
  | { action: "setName"; agentId: string; name: string }
  | { action: "setAcpCommand"; agentId: string; acpCommand?: string | null }
  | { action: "assign"; projectId: string; agentId: string }
  | { action: "unassign"; projectId: string; agentId: string };

export type UseAgentsOptions = {
  projectId?: string | null;
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseAgentsResult = {
  agents: AgentSummary[] | undefined;
  projectAgentIds: string[] | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
  fetchAgent: (agentId: string) => Promise<Agent>;
  createAgent: (name: string, acpCommand?: string | null) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  setAgentName: (agentId: string, name: string) => Promise<void>;
  setAgentAcpCommand: (agentId: string, acpCommand?: string | null) => Promise<void>;
  assignAgentToProject: (agentId: string) => Promise<void>;
  unassignAgentFromProject: (agentId: string) => Promise<void>;
  isMutating: boolean;
  mutationError: Error | null;
  resetMutation: () => void;
};

export function useAgents(options?: UseAgentsOptions): UseAgentsResult {
  const {
    projectId: projectIdOption,
    pollIntervalMs = DEFAULT_IPC_POLL_INTERVAL_MS,
    enabled: enabledOption = true,
  } = options ?? {};
  const { projectId: activeProjectId } = useActiveProject();
  const projectId = projectIdOption ?? activeProjectId;
  const enabled = enabledOption;

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<AgentsData>(
    `agents:${projectId ?? "none"}`,
    async (client) => {
      const [agents, projectAgentIds] = await Promise.all([
        client.listAgentSummaries(),
        projectId != null ? client.listProjectAgentIds(projectId) : Promise.resolve([]),
      ]);

      return { agents, projectAgentIds };
    },
    { pollIntervalMs, enabled },
  );

  const {
    mutateAsync: writeAgents,
    isPending: isMutating,
    error: mutationError,
    reset: resetMutation,
  } = useIpcMutation<
    AgentsWriteInput,
    Agent | CreateAgentResponse | SetAgentNameResponse | SetAgentAcpCommandResponse | void
  >(async (client, input) => {
    switch (input.action) {
      case "create":
        return client.createAgent(input.name, input.acpCommand ?? null);
      case "delete":
        return client.deleteAgent(input.agentId);
      case "setName":
        return client.setAgentName(input.agentId, input.name);
      case "setAcpCommand":
        return client.setAgentAcpCommand(input.agentId, input.acpCommand ?? null);
      case "assign":
        return client.assignAgentToProject(input.projectId, input.agentId);
      case "unassign":
        return client.unassignAgentFromProject(input.projectId, input.agentId);
    }
  });

  const mutateAndRefetch = useCallback(
    async (input: AgentsWriteInput): Promise<void> => {
      await writeAgents(input);
      await refetch();
    },
    [refetch, writeAgents],
  );

  const fetchAgent = useCallback(async (agentId: string): Promise<Agent> => {
    if (!isIpcAvailable()) {
      throw new IpcUnavailableError();
    }
    return getIpcClient().getAgent(agentId);
  }, []);

  const createAgent = useCallback(
    async (name: string, acpCommand?: string | null): Promise<void> => {
      await mutateAndRefetch({ action: "create", name, acpCommand });
    },
    [mutateAndRefetch],
  );

  const deleteAgent = useCallback(
    async (agentId: string): Promise<void> => {
      await mutateAndRefetch({ action: "delete", agentId });
    },
    [mutateAndRefetch],
  );

  const setAgentName = useCallback(
    async (agentId: string, name: string): Promise<void> => {
      await mutateAndRefetch({ action: "setName", agentId, name });
    },
    [mutateAndRefetch],
  );

  const setAgentAcpCommand = useCallback(
    async (agentId: string, acpCommand?: string | null): Promise<void> => {
      await mutateAndRefetch({ action: "setAcpCommand", agentId, acpCommand });
    },
    [mutateAndRefetch],
  );

  const assignAgentToProject = useCallback(
    async (agentId: string): Promise<void> => {
      await mutateAndRefetch({
        action: "assign",
        projectId: requireProjectId(projectId),
        agentId,
      });
    },
    [mutateAndRefetch, projectId],
  );

  const unassignAgentFromProject = useCallback(
    async (agentId: string): Promise<void> => {
      await mutateAndRefetch({
        action: "unassign",
        projectId: requireProjectId(projectId),
        agentId,
      });
    },
    [mutateAndRefetch, projectId],
  );

  return {
    agents: data?.agents,
    projectAgentIds: data?.projectAgentIds,
    error,
    isLoading,
    isRefreshing,
    refetch,
    fetchAgent,
    createAgent,
    deleteAgent,
    setAgentName,
    setAgentAcpCommand,
    assignAgentToProject,
    unassignAgentFromProject,
    isMutating,
    mutationError,
    resetMutation,
  };
}

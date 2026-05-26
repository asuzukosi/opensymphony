import type { ProjectBoard } from "@/ipc";
import { useIpcQuery } from "./use-ipc-query";

export type {
  ProjectBoard,
  ProjectBoardColumn,
  ProjectBoardIssue,
} from "@/ipc";

export type UseProjectBoardOptions = {
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseProjectBoardResult = {
  board: ProjectBoard | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
};

const DEFAULT_POLL_INTERVAL_MS = 5000;

export function useProjectBoard(options?: UseProjectBoardOptions): UseProjectBoardResult {
  const { pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, enabled = true } = options ?? {};

  const { data, error, isLoading, isRefreshing, refetch } = useIpcQuery<ProjectBoard>(
    "project-board",
    (client) => client.getProjectBoard(),
    { pollIntervalMs, enabled },
  );

  return {
    board: data,
    error,
    isLoading,
    isRefreshing,
    refetch,
  };
}

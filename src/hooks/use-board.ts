"use client";

import { useCallback, useEffect, useState } from "react";

import { getIpcClient, IpcUnavailableError, isIpcAvailable } from "@/lib/ipc/client";
import { BOARD_COLUMN_IDS, type ProjectBoard } from "@/lib/ipc/types";

const EMPTY_BOARD: ProjectBoard = {
  backlog: { issues: [] },
  inProgress: { issues: [] },
  review: { issues: [] },
  done: { issues: [] },
};

async function fetchBoard(projectId: string): Promise<ProjectBoard> {
  const client = getIpcClient();
  const columns = await Promise.all(
    BOARD_COLUMN_IDS.map((column) => client.getBoardColumn(projectId, column)),
  );

  return {
    backlog: columns[0],
    inProgress: columns[1],
    review: columns[2],
    done: columns[3],
  };
}

export type UseBoardResult = {
  board: ProjectBoard | undefined;
  error: Error | null;
  isLoading: boolean;
  isIpcAvailable: boolean;
  refetch: () => Promise<void>;
};

export function useBoard(): UseBoardResult {
  const [mounted, setMounted] = useState(false);
  const [board, setBoard] = useState<ProjectBoard | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const ipcAvailable = mounted && isIpcAvailable();

  const refetch = useCallback(async (): Promise<void> => {
    if (!isIpcAvailable()) {
      setError(new IpcUnavailableError());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = getIpcClient();
      const projectId = await client.getActiveProjectId();

      if (!projectId) {
        setBoard(EMPTY_BOARD);
        return;
      }

      const nextBoard = await fetchBoard(projectId);
      setBoard(nextBoard);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError : new Error("failed to load board"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    void refetch();
  }, [mounted, refetch]);

  return {
    board,
    error,
    isLoading: !mounted || isLoading,
    isIpcAvailable: ipcAvailable,
    refetch,
  };
}

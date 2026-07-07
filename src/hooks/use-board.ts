"use client";

import { useCallback, useEffect, useState } from "react";

import { getIpcClient, IpcUnavailableError, isIpcAvailable } from "@/lib/ipc/client";
import type { ProjectBoard } from "@/lib/ipc/types";

export type UseBoardResult = {
  board: ProjectBoard | undefined;
  error: Error | null;
  isLoading: boolean;
  isIpcAvailable: boolean;
  refetch: () => Promise<void>;
};

export function useBoard(): UseBoardResult {
  const ipcAvailable = isIpcAvailable();
  const [board, setBoard] = useState<ProjectBoard | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(ipcAvailable);

  const refetch = useCallback(async (): Promise<void> => {
    if (!ipcAvailable) {
      setError(new IpcUnavailableError());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextBoard = await getIpcClient().getProjectBoard();
      setBoard(nextBoard);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError : new Error("failed to load board"));
    } finally {
      setIsLoading(false);
    }
  }, [ipcAvailable]);

  // fectch board on mount only off refetch is changed
  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    board,
    error,
    isLoading,
    isIpcAvailable: ipcAvailable,
    refetch,
  };
}

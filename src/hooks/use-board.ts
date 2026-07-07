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
  const [mounted, setMounted] = useState(false);
  const [board, setBoard] = useState<ProjectBoard | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const ipcAvailable = mounted && isIpcAvailable(); // only set to true after mounted

  const refetch = useCallback(async (): Promise<void> => {
    if (!isIpcAvailable()) {
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

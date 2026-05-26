import { useCallback, useEffect, useRef, useState } from "react";
import { getIpcClient, IpcUnavailableError, isIpcAvailable } from "@/renderer/lib/ipc-client";
import type { SymphonyDesktopApi } from "@/ipc";

export type IpcQueryFn<T> = (client: SymphonyDesktopApi) => Promise<T>;

export type UseIpcQueryOptions = {
  pollIntervalMs?: number;
  enabled?: boolean;
};

export type UseIpcQueryResult<T> = {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
};

export function useIpcQuery<T>(
  queryKey: string,
  queryFn: IpcQueryFn<T>,
  options?: UseIpcQueryOptions,
): UseIpcQueryResult<T> {
  const { pollIntervalMs, enabled = true } = options ?? {};
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const queryFnRef = useRef(queryFn);

  queryFnRef.current = queryFn;

  const refetch = useCallback(async (): Promise<void> => {
    if (!enabled) return;

    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      if (!isIpcAvailable()) {
        throw new IpcUnavailableError();
      }

      const result = await queryFnRef.current(getIpcClient());
      if (!mountedRef.current) return;

      setData(result);
      setError(null);
      hasLoadedRef.current = true;
    } catch (fetchError) {
      if (!mountedRef.current) return;
      setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
    } finally {
      if (!mountedRef.current) return;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    hasLoadedRef.current = false;
    setData(undefined);
    setError(null);
    setIsLoading(enabled);
    setIsRefreshing(false);

    return () => {
      mountedRef.current = false;
    };
  }, [queryKey, enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    void refetch();

    if (pollIntervalMs == null || pollIntervalMs <= 0) {
      return;
    }

    const interval = setInterval(() => {
      void refetch();
    }, pollIntervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, pollIntervalMs, queryKey, refetch]);

  return { data, error, isLoading, isRefreshing, refetch };
}

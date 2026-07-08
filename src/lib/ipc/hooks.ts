"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getIpcClient, IpcUnavailableError, isIpcAvailable, type OpenSymphonyDesktopApi } from "@/lib/ipc/client";

export type IpcQueryFn<T> = (client: OpenSymphonyDesktopApi) => Promise<T>;

export type UseIpcQueryOptions = {
  pollIntervalMs?: number;
  enabled?: boolean;
};

export const DEFAULT_IPC_POLL_INTERVAL_MS = 5000;

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
    if (!enabled) {
      return;
    }

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
      if (!mountedRef.current) {
        return;
      }

      setData(result);
      setError(null);
      hasLoadedRef.current = true;
    } catch (fetchError) {
      if (!mountedRef.current) {
        return;
      }
      setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
    } finally {
      if (!mountedRef.current) {
        return;
      }
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

export type IpcMutationFn<TInput, TResult> = (
  client: OpenSymphonyDesktopApi,
  input: TInput,
) => Promise<TResult>;

export type UseIpcMutationResult<TInput, TResult> = {
  mutate: (input: TInput) => void;
  mutateAsync: (input: TInput) => Promise<TResult>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
};

export function useIpcMutation<TInput, TResult>(
  mutationFn: IpcMutationFn<TInput, TResult>,
): UseIpcMutationResult<TInput, TResult> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const mutationFnRef = useRef(mutationFn);

  mutationFnRef.current = mutationFn;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = useCallback((): void => {
    setError(null);
    setIsPending(false);
  }, []);

  const mutateAsync = useCallback(async (input: TInput): Promise<TResult> => {
    setIsPending(true);
    setError(null);

    try {
      if (!isIpcAvailable()) {
        throw new IpcUnavailableError();
      }

      const result = await mutationFnRef.current(getIpcClient(), input);
      return result;
    } catch (mutationError) {
      const normalized =
        mutationError instanceof Error ? mutationError : new Error(String(mutationError));
      if (mountedRef.current) {
        setError(normalized);
      }
      throw normalized;
    } finally {
      if (mountedRef.current) {
        setIsPending(false);
      }
    }
  }, []);

  const mutate = useCallback(
    (input: TInput): void => {
      void mutateAsync(input).catch(() => {
        // error is stored in hook state
      });
    },
    [mutateAsync],
  );

  return { mutate, mutateAsync, isPending, error, reset };
}

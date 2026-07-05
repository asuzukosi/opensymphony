import { useCallback, useEffect, useRef, useState } from "react";
import { getIpcClient, IpcUnavailableError, isIpcAvailable } from "@/renderer/lib/ipc-client";
import type { SymphonyDesktopApi } from "@/ipc";

export type IpcMutationFn<TInput, TResult> = (
  client: SymphonyDesktopApi,
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

import type { ControlRuntimeRequest, RuntimeStateSnapshot } from "@/ipc";
import { useIpcMutation } from "./use-ipc-mutation";

export type UseRuntimeControlsResult = {
  start: () => Promise<RuntimeStateSnapshot>;
  stop: () => Promise<RuntimeStateSnapshot>;
  tick: () => Promise<RuntimeStateSnapshot>;
  setPollInterval: (pollIntervalMs: number) => Promise<RuntimeStateSnapshot>;
  clearPollIntervalOverride: () => Promise<RuntimeStateSnapshot>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
};

export function useRuntimeControls(): UseRuntimeControlsResult {
  const controlMutation = useIpcMutation<ControlRuntimeRequest, RuntimeStateSnapshot>(
    (client, request) => client.controlRuntime(request),
  );

  return {
    start: () => controlMutation.mutateAsync({ action: "start" }),
    stop: () => controlMutation.mutateAsync({ action: "stop" }),
    tick: () => controlMutation.mutateAsync({ action: "tick" }),
    setPollInterval: (pollIntervalMs) =>
      controlMutation.mutateAsync({ action: "setPollInterval", pollIntervalMs }),
    clearPollIntervalOverride: () =>
      controlMutation.mutateAsync({ action: "clearPollIntervalOverride" }),
    isPending: controlMutation.isPending,
    error: controlMutation.error,
    reset: controlMutation.reset,
  };
}

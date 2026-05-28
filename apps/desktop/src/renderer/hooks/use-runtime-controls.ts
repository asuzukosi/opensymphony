import type { ControlRuntimeRequest, PermissionMode, RuntimeStateSnapshot } from "@/ipc";
import { useIpcMutation } from "./use-ipc-mutation";

export type UseRuntimeControlsResult = {
  start: () => Promise<RuntimeStateSnapshot>;
  stop: () => Promise<RuntimeStateSnapshot>;
  tick: () => Promise<RuntimeStateSnapshot>;
  setPollInterval: (pollIntervalMs: number) => Promise<RuntimeStateSnapshot>;
  clearPollIntervalOverride: () => Promise<RuntimeStateSnapshot>;
  setPermissionMode: (permissionMode: PermissionMode) => Promise<RuntimeStateSnapshot>;
  clearPermissionModeOverride: () => Promise<RuntimeStateSnapshot>;
  pauseRun: (runAttemptId: string) => Promise<RuntimeStateSnapshot>;
  resumeRun: (runAttemptId: string) => Promise<RuntimeStateSnapshot>;
  cancelRun: (runAttemptId: string) => Promise<RuntimeStateSnapshot>;
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
    setPermissionMode: (permissionMode) =>
      controlMutation.mutateAsync({ action: "setPermissionMode", permissionMode }),
    clearPermissionModeOverride: () =>
      controlMutation.mutateAsync({ action: "clearPermissionModeOverride" }),
    pauseRun: (runAttemptId) =>
      controlMutation.mutateAsync({ action: "pauseRun", runAttemptId }),
    resumeRun: (runAttemptId) =>
      controlMutation.mutateAsync({ action: "resumeRun", runAttemptId }),
    cancelRun: (runAttemptId) =>
      controlMutation.mutateAsync({ action: "cancelRun", runAttemptId }),
    isPending: controlMutation.isPending,
    error: controlMutation.error,
    reset: controlMutation.reset,
  };
}

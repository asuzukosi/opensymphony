import { isTauri } from "@tauri-apps/api/core";
import { type UnlistenFn, listen } from "@tauri-apps/api/event";

const RUNTIME_EVENTS = [
  "runtime:running-changed",
  "runtime:retry-changed",
  "runtime:finished-changed",
  "runtime:orchestrator-status",
] as const;

export type RuntimeEventListener = {
  onChange?: () => void;
  onOrchestratorStatus?: (status: string) => void;
};

export async function listenRuntimeEvents(
  projectId: string,
  listener: RuntimeEventListener,
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }

  const unlisteners: UnlistenFn[] = [];

  for (const event of RUNTIME_EVENTS) {
    const unlisten = await listen<{ projectId: string; status?: string }>(event, (payload) => {
      if (payload.payload.projectId !== projectId) {
        return;
      }
      if (event === "runtime:orchestrator-status" && payload.payload.status != null) {
        listener.onOrchestratorStatus?.(payload.payload.status);
      }
      listener.onChange?.();
    });
    unlisteners.push(unlisten);
  }

  return () => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  };
}

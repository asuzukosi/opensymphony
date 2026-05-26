import type { SymphonyDesktopApi } from "@/ipc";

declare global {
  interface Window {
    symphonyDesktop?: SymphonyDesktopApi;
  }
}

/**
 * typed access to the preload-exposed symphony desktop api.
 * hooks call methods on this client to read task/runtime/issue data or invoke commands.
 */

export class IpcUnavailableError extends Error {
  constructor(message = "desktop ipc unavailable") {
    super(message);
    this.name = "IpcUnavailableError";
  }
}

export function isIpcAvailable(): boolean {
  return typeof window !== "undefined" && window.symphonyDesktop != null;
}

export function getIpcClient(): SymphonyDesktopApi {
  const client = typeof window !== "undefined" ? window.symphonyDesktop : undefined;
  if (!client) {
    throw new IpcUnavailableError();
  }
  return client;
}

export type { SymphonyDesktopApi } from "@/ipc";

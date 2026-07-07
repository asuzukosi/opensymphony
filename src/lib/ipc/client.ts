import { invoke, isTauri } from "@tauri-apps/api/core";
import { IPC_CHANNELS } from "@/lib/ipc/channels";
import type {
  ControlRuntimeRequest,
  IssueDetail,
  MutateIssueRequest,
  PendingPermission,
  ProjectBoard,
  ResolvePermissionRequest,
  RuntimeStateSnapshot,
  SettingsView,
} from "@/lib/ipc/types";

export class IpcUnavailableError extends Error {
  constructor(message = "Desktop IPC unavailable") {
    super(message);
    this.name = "IpcUnavailableError";
  }
}

export function isIpcAvailable(): boolean {
  return typeof window !== "undefined" && isTauri();
}

export interface OpenSymphonyDesktopApi {
  getRuntimeState(eventLimit?: number): Promise<RuntimeStateSnapshot>;
  getProjectBoard(): Promise<ProjectBoard>;
  getIssue(issueId: string, attemptLimit?: number): Promise<IssueDetail>;
  mutateIssue(request: MutateIssueRequest): Promise<void>;
  controlRuntime(request: ControlRuntimeRequest): Promise<RuntimeStateSnapshot>;
  getSettings(): Promise<SettingsView>;
  getPendingPermissions(): Promise<PendingPermission[]>;
  resolvePermission(request: ResolvePermissionRequest): Promise<void>;
}

function createIpcClient(): OpenSymphonyDesktopApi {
  return {
    getRuntimeState: (eventLimit) =>
      invoke<RuntimeStateSnapshot>(IPC_CHANNELS.getRuntimeState, {
        eventLimit: eventLimit ?? null,
      }),
    getProjectBoard: () => invoke<ProjectBoard>(IPC_CHANNELS.getProjectBoard),
    getIssue: (issueId, attemptLimit) =>
      invoke<IssueDetail>(IPC_CHANNELS.getIssue, {
        issueId,
        attemptLimit: attemptLimit ?? null,
      }),
    mutateIssue: (request) => invoke<void>(IPC_CHANNELS.mutateIssue, { request }),
    controlRuntime: (request) =>
      invoke<RuntimeStateSnapshot>(IPC_CHANNELS.controlRuntime, { request }),
    getSettings: () => invoke<SettingsView>(IPC_CHANNELS.getSettings),
    getPendingPermissions: () =>
      invoke<PendingPermission[]>(IPC_CHANNELS.getPendingPermissions),
    resolvePermission: (request) =>
      invoke<void>(IPC_CHANNELS.resolvePermission, { request }),
  };
}

let cachedClient: OpenSymphonyDesktopApi | null = null;

export function getIpcClient(): OpenSymphonyDesktopApi {
  if (!isIpcAvailable()) {
    throw new IpcUnavailableError();
  }
  if (!cachedClient) {
    cachedClient = createIpcClient();
  }
  return cachedClient;
}

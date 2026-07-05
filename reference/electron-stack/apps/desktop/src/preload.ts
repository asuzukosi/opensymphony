import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type SymphonyDesktopApi } from "@/ipc";

export function createDesktopApi(): SymphonyDesktopApi {
  return {
    async getRuntimeState(eventLimit?: number) {
      return ipcRenderer.invoke(IPC_CHANNELS.getRuntimeState, eventLimit);
    },
    async getProjectBoard() {
      return ipcRenderer.invoke(IPC_CHANNELS.getProjectBoard);
    },
    async getIssue(issueId: string, attemptLimit?: number) {
      return ipcRenderer.invoke(IPC_CHANNELS.getIssue, issueId, attemptLimit);
    },
    async mutateIssue(request) {
      return ipcRenderer.invoke(IPC_CHANNELS.mutateIssue, request);
    },
    async controlRuntime(request) {
      return ipcRenderer.invoke(IPC_CHANNELS.controlRuntime, request);
    },
    async getSettings() {
      return ipcRenderer.invoke(IPC_CHANNELS.getSettings);
    },
    async getPendingPermissions() {
      return ipcRenderer.invoke(IPC_CHANNELS.getPendingPermissions);
    },
    async resolvePermission(request) {
      return ipcRenderer.invoke(IPC_CHANNELS.resolvePermission, request);
    },
  };
}

contextBridge.exposeInMainWorld("symphonyDesktop", createDesktopApi());

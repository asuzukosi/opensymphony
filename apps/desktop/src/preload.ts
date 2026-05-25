import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type SymphonyDesktopApi } from "@/ipc";

export function createDesktopApi(): SymphonyDesktopApi {
  return {
    async getSystemInfo() {
      return ipcRenderer.invoke(IPC_CHANNELS.getSystemInfo);
    },
    async getOrchestratorStatus() {
      return ipcRenderer.invoke(IPC_CHANNELS.getOrchestratorStatus);
    },
    async getOrchestratorSnapshot() {
      return ipcRenderer.invoke(IPC_CHANNELS.getOrchestratorSnapshot);
    },
    async getOrchestratorIssueQueues() {
      return ipcRenderer.invoke(IPC_CHANNELS.getOrchestratorIssueQueues);
    },
    async getRecentAuditEvents(limit?: number) {
      return ipcRenderer.invoke(IPC_CHANNELS.getRecentAuditEvents, limit);
    },
    async getIssueRunHistory(issueId: string, limit?: number) {
      return ipcRenderer.invoke(IPC_CHANNELS.getIssueRunHistory, issueId, limit);
    },
    async startOrchestratorRuntime() {
      return ipcRenderer.invoke(IPC_CHANNELS.startOrchestratorRuntime);
    },
    async stopOrchestratorRuntime() {
      return ipcRenderer.invoke(IPC_CHANNELS.stopOrchestratorRuntime);
    },
    async runOrchestratorTick() {
      return ipcRenderer.invoke(IPC_CHANNELS.runOrchestratorTick);
    },
    async setOrchestratorPollIntervalMs(pollIntervalMs: number) {
      return ipcRenderer.invoke(IPC_CHANNELS.setOrchestratorPollIntervalMs, pollIntervalMs);
    },
    async clearOrchestratorPollIntervalOverride() {
      return ipcRenderer.invoke(IPC_CHANNELS.clearOrchestratorPollIntervalOverride);
    },
    async transitionIssue(issueId: string, targetStateId: string, actor?: string) {
      return ipcRenderer.invoke(IPC_CHANNELS.transitionIssue, issueId, targetStateId, actor);
    },
    async addIssueComment(issueId: string, body: string, authorId?: string) {
      return ipcRenderer.invoke(IPC_CHANNELS.addIssueComment, issueId, body, authorId);
    },
  };
}

const desktopApi = createDesktopApi();

contextBridge.exposeInMainWorld("symphonyDesktop", desktopApi);

import { contextBridge, ipcRenderer } from 'electron';

const IPC_CHANNELS = {
  getSystemInfo: 'symphony:get-system-info',
  getOrchestratorStatus: 'symphony:get-orchestrator-status',
  getOrchestratorSnapshot: 'symphony:get-orchestrator-snapshot',
  getOrchestratorIssueQueues: 'symphony:get-orchestrator-issue-queues',
  getRecentAuditEvents: 'symphony:get-recent-audit-events',
  getIssueRunHistory: 'symphony:get-issue-run-history',
  startOrchestratorRuntime: 'symphony:start-orchestrator-runtime',
  stopOrchestratorRuntime: 'symphony:stop-orchestrator-runtime',
  runOrchestratorTick: 'symphony:run-orchestrator-tick',
  setOrchestratorPollIntervalMs: 'symphony:set-orchestrator-poll-interval-ms',
  clearOrchestratorPollIntervalOverride: 'symphony:clear-orchestrator-poll-interval-override',
  transitionIssue: 'symphony:transition-issue',
  addIssueComment: 'symphony:add-issue-comment'
};

const desktopApi = {
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
  async getRecentAuditEvents(limit) {
    return ipcRenderer.invoke(IPC_CHANNELS.getRecentAuditEvents, limit);
  },
  async getIssueRunHistory(issueId, limit) {
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
  async setOrchestratorPollIntervalMs(pollIntervalMs) {
    return ipcRenderer.invoke(IPC_CHANNELS.setOrchestratorPollIntervalMs, pollIntervalMs);
  },
  async clearOrchestratorPollIntervalOverride() {
    return ipcRenderer.invoke(IPC_CHANNELS.clearOrchestratorPollIntervalOverride);
  },
  async transitionIssue(issueId, targetStateId, actor) {
    return ipcRenderer.invoke(IPC_CHANNELS.transitionIssue, issueId, targetStateId, actor);
  },
  async addIssueComment(issueId, body, authorId) {
    return ipcRenderer.invoke(IPC_CHANNELS.addIssueComment, issueId, body, authorId);
  }
};

contextBridge.exposeInMainWorld('symphonyDesktop', desktopApi);

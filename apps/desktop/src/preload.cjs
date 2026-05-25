const { contextBridge, ipcRenderer } = require("electron");

const IPC_CHANNELS = {
  getSystemInfo: "symphony:get-system-info",
  getOrchestratorStatus: "symphony:get-orchestrator-status",
  getOrchestratorSnapshot: "symphony:get-orchestrator-snapshot",
  getOrchestratorIssueQueues: "symphony:get-orchestrator-issue-queues",
  getRecentAuditEvents: "symphony:get-recent-audit-events",
  getIssueRunHistory: "symphony:get-issue-run-history",
  startOrchestratorRuntime: "symphony:start-orchestrator-runtime",
  stopOrchestratorRuntime: "symphony:stop-orchestrator-runtime",
  runOrchestratorTick: "symphony:run-orchestrator-tick",
  setOrchestratorPollIntervalMs: "symphony:set-orchestrator-poll-interval-ms",
  clearOrchestratorPollIntervalOverride: "symphony:clear-orchestrator-poll-interval-override",
  transitionIssue: "symphony:transition-issue",
  addIssueComment: "symphony:add-issue-comment",
};

const desktopApi = {
  getSystemInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getSystemInfo),
  getOrchestratorStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getOrchestratorStatus),
  getOrchestratorSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.getOrchestratorSnapshot),
  getOrchestratorIssueQueues: () => ipcRenderer.invoke(IPC_CHANNELS.getOrchestratorIssueQueues),
  getRecentAuditEvents: (limit) => ipcRenderer.invoke(IPC_CHANNELS.getRecentAuditEvents, limit),
  getIssueRunHistory: (issueId, limit) =>
    ipcRenderer.invoke(IPC_CHANNELS.getIssueRunHistory, issueId, limit),
  startOrchestratorRuntime: () => ipcRenderer.invoke(IPC_CHANNELS.startOrchestratorRuntime),
  stopOrchestratorRuntime: () => ipcRenderer.invoke(IPC_CHANNELS.stopOrchestratorRuntime),
  runOrchestratorTick: () => ipcRenderer.invoke(IPC_CHANNELS.runOrchestratorTick),
  setOrchestratorPollIntervalMs: (pollIntervalMs) =>
    ipcRenderer.invoke(IPC_CHANNELS.setOrchestratorPollIntervalMs, pollIntervalMs),
  clearOrchestratorPollIntervalOverride: () =>
    ipcRenderer.invoke(IPC_CHANNELS.clearOrchestratorPollIntervalOverride),
  transitionIssue: (issueId, targetStateId, actor) =>
    ipcRenderer.invoke(IPC_CHANNELS.transitionIssue, issueId, targetStateId, actor),
  addIssueComment: (issueId, body, authorId) =>
    ipcRenderer.invoke(IPC_CHANNELS.addIssueComment, issueId, body, authorId),
};

contextBridge.exposeInMainWorld("symphonyDesktop", desktopApi);

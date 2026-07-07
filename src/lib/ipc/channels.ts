export const IPC_CHANNELS = {
  getRuntimeState: "opensymphony:get-runtime-state",
  getProjectBoard: "opensymphony:get-project-board",
  getIssue: "opensymphony:get-issue",
  mutateIssue: "opensymphony:mutate-issue",
  controlRuntime: "opensymphony:control-runtime",
  getSettings: "opensymphony:get-settings",
  getPendingPermissions: "opensymphony:get-pending-permissions",
  resolvePermission: "opensymphony:resolve-permission",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

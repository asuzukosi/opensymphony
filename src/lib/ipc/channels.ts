export const IPC_CHANNELS = {
  // board reads
  getBoardColumn: "opensymphony:get-board-column",
  getBoardIssueCard: "opensymphony:get-board-issue-card",
  // issue reads
  getIssueHeader: "opensymphony:get-issue-header",
  listIssueComments: "opensymphony:list-issue-comments",
  listIssueRunAttempts: "opensymphony:list-issue-run-attempts",
  listSessionEvents: "opensymphony:list-session-events",
  // issue writes
  createIssue: "opensymphony:create-issue",
  updateIssueTitle: "opensymphony:update-issue-title",
  updateIssueDescription: "opensymphony:update-issue-description",
  updateIssuePriority: "opensymphony:update-issue-priority",
  transitionIssueColumn: "opensymphony:transition-issue-column",
  addIssueComment: "opensymphony:add-issue-comment",
  // permissions reads
  listIssuePendingPermissions: "opensymphony:list-issue-pending-permissions",
  // permissions writes
  resolveSessionPermission: "opensymphony:resolve-session-permission",
  // runtime reads
  getRuntimeSummary: "opensymphony:get-runtime-summary",
  getRuntimeRunning: "opensymphony:get-runtime-running",
  getRuntimeRetrying: "opensymphony:get-runtime-retrying",
  getRuntimeCandidates: "opensymphony:get-runtime-candidates",
  getRuntimeRecentFinished: "opensymphony:get-runtime-recent-finished",
  getRuntimeRecentEvents: "opensymphony:get-runtime-recent-events",
  // runtime writes
  startRuntime: "opensymphony:start-runtime",
  stopRuntime: "opensymphony:stop-runtime",
  tickRuntime: "opensymphony:tick-runtime",
  setRuntimePollInterval: "opensymphony:set-runtime-poll-interval",
  clearRuntimePollIntervalOverride: "opensymphony:clear-runtime-poll-interval-override",
  pauseRun: "opensymphony:pause-run",
  resumeRun: "opensymphony:resume-run",
  cancelRun: "opensymphony:cancel-run",
  // project reads
  listProjectSummaries: "opensymphony:list-project-summaries",
  getProjectName: "opensymphony:get-project-name",
  getProjectWorkflowSource: "opensymphony:get-project-workflow-source",
  getProjectWorkflowFilePath: "opensymphony:get-project-workflow-file-path",
  getProjectWorkflowVersion: "opensymphony:get-project-workflow-version",
  getProjectPromptTemplate: "opensymphony:get-project-prompt-template",
  getProjectPollInterval: "opensymphony:get-project-poll-interval",
  getProjectMaxConcurrency: "opensymphony:get-project-max-concurrency",
  getProjectRetryPolicy: "opensymphony:get-project-retry-policy",
  getProjectPermissionMode: "opensymphony:get-project-permission-mode",
  getProjectOrchestratorStatus: "opensymphony:get-project-orchestrator-status",
  // project writes
  createProject: "opensymphony:create-project",
  deleteProject: "opensymphony:delete-project",
  setProjectName: "opensymphony:set-project-name",
  setProjectWorkflowFile: "opensymphony:set-project-workflow-file",
  importProjectWorkflowFile: "opensymphony:import-project-workflow-file",
  setProjectPromptTemplate: "opensymphony:set-project-prompt-template",
  setProjectPollInterval: "opensymphony:set-project-poll-interval",
  setProjectMaxConcurrency: "opensymphony:set-project-max-concurrency",
  setProjectRetryPolicy: "opensymphony:set-project-retry-policy",
  setProjectPermissionMode: "opensymphony:set-project-permission-mode",
  // agent reads
  listAgentSummaries: "opensymphony:list-agent-summaries",
  getAgent: "opensymphony:get-agent",
  listProjectAgentIds: "opensymphony:list-project-agent-ids",
  // agent writes
  createAgent: "opensymphony:create-agent",
  deleteAgent: "opensymphony:delete-agent",
  setAgentName: "opensymphony:set-agent-name",
  setAgentAcpCommand: "opensymphony:set-agent-acp-command",
  assignAgentToProject: "opensymphony:assign-agent-to-project",
  unassignAgentFromProject: "opensymphony:unassign-agent-from-project",
  // analytics reads
  getProjectAgentActivityOverTime: "opensymphony:get-project-agent-activity-over-time",
  getProjectPermissionActivityOverTime:
    "opensymphony:get-project-permission-activity-over-time",
  // app state reads
  getActiveProjectId: "opensymphony:get-active-project-id",
  // app state writes
  setActiveProjectId: "opensymphony:set-active-project-id",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

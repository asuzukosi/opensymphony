export const IPC_CHANNELS = {
  // issue reads
  getIssueHeader: "opensymphony:get-issue-header",
  listProjectIssues: "opensymphony:list-project-issues",
  listIssueComments: "opensymphony:list-issue-comments",
  listIssueRunAttempts: "opensymphony:list-issue-run-attempts",
  listSessionEvents: "opensymphony:list-session-events",
  // issue writes
  createIssue: "opensymphony:create-issue",
  setIssueExecutor: "opensymphony:set-issue-executor",
  setIssueAutoApprovePermissions: "opensymphony:set-issue-auto-approve-permissions",
  setIssueTags: "opensymphony:set-issue-tags",
  attachIssueFiles: "opensymphony:attach-issue-files",
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
  getProjectPromptTemplate: "opensymphony:get-project-prompt-template",
  getProjectPollInterval: "opensymphony:get-project-poll-interval",
  getProjectMaxConcurrency: "opensymphony:get-project-max-concurrency",
  getProjectRetryPolicy: "opensymphony:get-project-retry-policy",
  getProjectOrchestratorStatus: "opensymphony:get-project-orchestrator-status",
  // project writes
  createProject: "opensymphony:create-project",
  deleteProject: "opensymphony:delete-project",
  setProjectName: "opensymphony:set-project-name",
  setProjectPromptTemplate: "opensymphony:set-project-prompt-template",
  setProjectPollInterval: "opensymphony:set-project-poll-interval",
  setProjectMaxConcurrency: "opensymphony:set-project-max-concurrency",
  setProjectRetryPolicy: "opensymphony:set-project-retry-policy",
  // platform
  listPlatformStatuses: "opensymphony:list-platform-statuses",
  listProjectPlatforms: "opensymphony:list-project-platforms",
  // analytics reads
  getAgentActivityOverTime: "opensymphony:get-agent-activity-over-time",
} as const;

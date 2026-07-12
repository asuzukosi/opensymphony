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
  getRuntimeRunning: "opensymphony:get-runtime-running",
  getRuntimeRetrying: "opensymphony:get-runtime-retrying",
  getRuntimeRecentFinished: "opensymphony:get-runtime-recent-finished",
  getRuntimeRecentEvents: "opensymphony:get-runtime-recent-events",
  // runtime writes
  pauseRun: "opensymphony:pause-run",
  resumeRun: "opensymphony:resume-run",
  cancelRun: "opensymphony:cancel-run",
  // project reads
  listProjectSummaries: "opensymphony:list-project-summaries",
  getProjectPollInterval: "opensymphony:get-project-poll-interval",
  getProjectMaxConcurrency: "opensymphony:get-project-max-concurrency",
  getProjectRetryPolicy: "opensymphony:get-project-retry-policy",
  getProjectOrchestratorStatus: "opensymphony:get-project-orchestrator-status",
  // project writes
  createProject: "opensymphony:create-project",
  deleteProject: "opensymphony:delete-project",
  setProjectName: "opensymphony:set-project-name",
  setProjectPollInterval: "opensymphony:set-project-poll-interval",
  setProjectMaxConcurrency: "opensymphony:set-project-max-concurrency",
  setProjectRetryPolicy: "opensymphony:set-project-retry-policy",
  // platform
  listPlatformStatuses: "opensymphony:list-platform-statuses",
  listProjectPlatforms: "opensymphony:list-project-platforms",
  // analytics reads
  getAgentActivityOverTime: "opensymphony:get-agent-activity-over-time",
} as const;

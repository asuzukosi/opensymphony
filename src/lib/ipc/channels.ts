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
  // runtime writes
  pauseRun: "opensymphony:pause-run",
  resumeRun: "opensymphony:resume-run",
  cancelRun: "opensymphony:cancel-run",
  // project reads
  listProjectSummaries: "opensymphony:list-project-summaries",
  getProjectMaxConcurrency: "opensymphony:get-project-max-concurrency",
  getProjectRetryPolicy: "opensymphony:get-project-retry-policy",
  // project writes
  createProject: "opensymphony:create-project",
  deleteProject: "opensymphony:delete-project",
  setProjectName: "opensymphony:set-project-name",
  setProjectMaxConcurrency: "opensymphony:set-project-max-concurrency",
  setProjectRetryPolicy: "opensymphony:set-project-retry-policy",
  // platform
  listPlatformStatuses: "opensymphony:list-platform-statuses",
  listProjectPlatforms: "opensymphony:list-project-platforms",
  // analytics reads
  getAgentActivityOverTime: "opensymphony:get-agent-activity-over-time",
} as const;

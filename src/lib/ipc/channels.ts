export const IPC_CHANNELS = {
  // task reads
  getTaskHeader: "opensymphony:get-task-header",
  listProjectTasks: "opensymphony:list-project-tasks",
  listTaskComments: "opensymphony:list-task-comments",
  listTaskRunAttempts: "opensymphony:list-task-run-attempts",
  listSessionEvents: "opensymphony:list-session-events",
  // task writes
  createTask: "opensymphony:create-task",
  setTaskExecutor: "opensymphony:set-task-executor",
  setTaskAutoApprovePermissions: "opensymphony:set-task-auto-approve-permissions",
  setTaskTags: "opensymphony:set-task-tags",
  attachTaskFiles: "opensymphony:attach-task-files",
  updateTaskPriority: "opensymphony:update-task-priority",
  transitionTaskColumn: "opensymphony:transition-task-column",
  addTaskComment: "opensymphony:add-task-comment",
  // permissions reads
  listTaskPendingPermissions: "opensymphony:list-task-pending-permissions",
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

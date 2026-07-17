import type { CreateProjectInput } from "@/lib/create-project-form";
import { IPC_CHANNELS } from "@/lib/ipc/channels";
import type {
  ActivityTimeRange,
  AddTaskCommentResponse,
  AgentActivityOverTimeResponse,
  AttachTaskFilesResponse,
  BoardColumnId,
  CreateTaskResponse,
  CreateProjectResponse,
  TaskComment,
  TaskDetailRunAttempt,
  TaskHeader,
  PendingPermission,
  PermissionDecision,
  PlatformId,
  PlatformInstallStatus,
  ProjectTaskListItem,
  ProjectSummary,
  RetryPolicy,
  RuntimeRecentFinishedEntry,
  RuntimeRetryEntry,
  RuntimeRunningEntry,
  SessionEvent,
  SetTaskAutoApprovePermissionsResponse,
  SetTaskExecutorResponse,
  SetTaskTagsResponse,
  SetProjectMaxConcurrencyResponse,
  SetProjectNameResponse,
  SetProjectRetryPolicyResponse,
  TransitionTaskColumnResponse,
  UpdateTaskPriorityResponse,
} from "@/lib/ipc/types";
import { invoke, isTauri } from "@tauri-apps/api/core";

export class IpcUnavailableError extends Error {
  constructor(message = "Desktop IPC unavailable") {
    super(message);
    this.name = "IpcUnavailableError";
  }
}

export function isIpcAvailable(): boolean {
  return typeof window !== "undefined" && isTauri();
}

export interface OpenSymphonyDesktopApi {
  // task reads
  getTaskHeader(taskId: string): Promise<TaskHeader>;
  listProjectTasks(projectId: string): Promise<ProjectTaskListItem[]>;
  listTaskComments(taskId: string): Promise<TaskComment[]>;
  listTaskRunAttempts(taskId: string): Promise<TaskDetailRunAttempt[]>;
  listSessionEvents(taskId: string): Promise<SessionEvent[]>;
  // task writes
  createTask(
    projectId: string,
    title: string,
    description?: string | null,
    executor?: PlatformId | null,
    priority?: number | null,
    tags?: string[],
  ): Promise<CreateTaskResponse>;
  setTaskExecutor(
    taskId: string,
    executor?: PlatformId | null,
  ): Promise<SetTaskExecutorResponse>;
  setTaskAutoApprovePermissions(
    taskId: string,
    autoApprovePermissions: boolean,
  ): Promise<SetTaskAutoApprovePermissionsResponse>;
  setTaskTags(taskId: string, tags: string[]): Promise<SetTaskTagsResponse>;
  attachTaskFiles(taskId: string, sourcePaths: string[]): Promise<AttachTaskFilesResponse>;
  updateTaskPriority(
    taskId: string,
    priority?: number | null,
  ): Promise<UpdateTaskPriorityResponse>;
  transitionTaskColumn(
    taskId: string,
    column: BoardColumnId,
    actor?: string | null,
  ): Promise<TransitionTaskColumnResponse>;
  addTaskComment(
    taskId: string,
    body: string,
    author?: string | null,
  ): Promise<AddTaskCommentResponse>;
  // permissions reads
  listTaskPendingPermissions(taskId: string): Promise<PendingPermission[]>;
  // permissions writes
  resolveSessionPermission(permissionId: string, decision: PermissionDecision): Promise<void>;
  // runtime reads
  getRuntimeRunning(projectId: string): Promise<RuntimeRunningEntry[]>;
  getRuntimeRetrying(projectId: string): Promise<RuntimeRetryEntry[]>;
  getRuntimeRecentFinished(projectId: string): Promise<RuntimeRecentFinishedEntry[]>;
  // runtime writes
  pauseRun(runAttemptId: string): Promise<void>;
  resumeRun(runAttemptId: string): Promise<void>;
  cancelRun(runAttemptId: string): Promise<void>;
  // project reads
  listProjectSummaries(): Promise<ProjectSummary[]>;
  getProjectMaxConcurrency(projectId: string): Promise<number>;
  getProjectRetryPolicy(projectId: string): Promise<RetryPolicy>;
  // project writes
  createProject(input: CreateProjectInput): Promise<CreateProjectResponse>;
  deleteProject(projectId: string): Promise<void>;
  setProjectName(projectId: string, name: string): Promise<SetProjectNameResponse>;
  setProjectMaxConcurrency(
    projectId: string,
    maxConcurrency: number,
  ): Promise<SetProjectMaxConcurrencyResponse>;
  setProjectRetryPolicy(
    projectId: string,
    maxAttempts: number,
    backoffMs: number,
  ): Promise<SetProjectRetryPolicyResponse>;
  // platform
  listPlatformStatuses(): Promise<PlatformInstallStatus[]>;
  listProjectPlatforms(projectId: string): Promise<PlatformId[]>;
  // analytics reads
  getAgentActivityOverTime(
    timeRange: ActivityTimeRange,
    projectId?: string | null,
  ): Promise<AgentActivityOverTimeResponse>;
}

function createIpcClient(): OpenSymphonyDesktopApi {
  return {
    // task reads
    getTaskHeader: (taskId) => invoke<TaskHeader>(IPC_CHANNELS.getTaskHeader, { taskId }),
    listProjectTasks: (projectId) =>
      invoke<ProjectTaskListItem[]>(IPC_CHANNELS.listProjectTasks, { projectId }),
    listTaskComments: (taskId) =>
      invoke<TaskComment[]>(IPC_CHANNELS.listTaskComments, { taskId }),
    listTaskRunAttempts: (taskId) =>
      invoke<TaskDetailRunAttempt[]>(IPC_CHANNELS.listTaskRunAttempts, { taskId }),
    listSessionEvents: (taskId) =>
      invoke<SessionEvent[]>(IPC_CHANNELS.listSessionEvents, { taskId }),
    // task writes
    createTask: (projectId, title, description, executor, priority, tags) =>
      invoke<CreateTaskResponse>(IPC_CHANNELS.createTask, {
        projectId,
        title,
        description: description ?? null,
        executor: executor ?? null,
        priority: priority ?? null,
        tags: tags ?? [],
      }),
    setTaskExecutor: (taskId, executor) =>
      invoke<SetTaskExecutorResponse>(IPC_CHANNELS.setTaskExecutor, {
        taskId,
        executor: executor ?? null,
      }),
    setTaskAutoApprovePermissions: (taskId, autoApprovePermissions) =>
      invoke<SetTaskAutoApprovePermissionsResponse>(IPC_CHANNELS.setTaskAutoApprovePermissions, {
        taskId,
        autoApprovePermissions,
      }),
    setTaskTags: (taskId, tags) =>
      invoke<SetTaskTagsResponse>(IPC_CHANNELS.setTaskTags, { taskId, tags }),
    attachTaskFiles: (taskId, sourcePaths) =>
      invoke<AttachTaskFilesResponse>(IPC_CHANNELS.attachTaskFiles, {
        taskId,
        sourcePaths,
      }),
    updateTaskPriority: (taskId, priority) =>
      invoke<UpdateTaskPriorityResponse>(IPC_CHANNELS.updateTaskPriority, {
        taskId,
        priority: priority ?? null,
      }),
    transitionTaskColumn: (taskId, column, actor) =>
      invoke<TransitionTaskColumnResponse>(IPC_CHANNELS.transitionTaskColumn, {
        taskId,
        column,
        actor: actor ?? null,
      }),
    addTaskComment: (taskId, body, author) =>
      invoke<AddTaskCommentResponse>(IPC_CHANNELS.addTaskComment, {
        taskId,
        body,
        author: author ?? null,
      }),
    // permissions reads
    listTaskPendingPermissions: (taskId) =>
      invoke<PendingPermission[]>(IPC_CHANNELS.listTaskPendingPermissions, { taskId }),
    // permissions writes
    resolveSessionPermission: (permissionId, decision) =>
      invoke<void>(IPC_CHANNELS.resolveSessionPermission, { permissionId, decision }),
    // runtime reads
    getRuntimeRunning: (projectId) =>
      invoke<RuntimeRunningEntry[]>(IPC_CHANNELS.getRuntimeRunning, { projectId }),
    getRuntimeRetrying: (projectId) =>
      invoke<RuntimeRetryEntry[]>(IPC_CHANNELS.getRuntimeRetrying, { projectId }),
    getRuntimeRecentFinished: (projectId) =>
      invoke<RuntimeRecentFinishedEntry[]>(IPC_CHANNELS.getRuntimeRecentFinished, {
        projectId,
      }),
    // runtime writes
    pauseRun: (runAttemptId) => invoke<void>(IPC_CHANNELS.pauseRun, { runAttemptId }),
    resumeRun: (runAttemptId) => invoke<void>(IPC_CHANNELS.resumeRun, { runAttemptId }),
    cancelRun: (runAttemptId) => invoke<void>(IPC_CHANNELS.cancelRun, { runAttemptId }),
    // project reads
    listProjectSummaries: () => invoke<ProjectSummary[]>(IPC_CHANNELS.listProjectSummaries),
    getProjectMaxConcurrency: (projectId) =>
      invoke<number>(IPC_CHANNELS.getProjectMaxConcurrency, { projectId }),
    getProjectRetryPolicy: (projectId) =>
      invoke<RetryPolicy>(IPC_CHANNELS.getProjectRetryPolicy, { projectId }),
    // project writes
    createProject: (input) => invoke<CreateProjectResponse>(IPC_CHANNELS.createProject, { input }),
    deleteProject: (projectId) => invoke<void>(IPC_CHANNELS.deleteProject, { projectId }),
    setProjectName: (projectId, name) =>
      invoke<SetProjectNameResponse>(IPC_CHANNELS.setProjectName, { projectId, name }),
    setProjectMaxConcurrency: (projectId, maxConcurrency) =>
      invoke<SetProjectMaxConcurrencyResponse>(IPC_CHANNELS.setProjectMaxConcurrency, {
        projectId,
        maxConcurrency,
      }),
    setProjectRetryPolicy: (projectId, maxAttempts, backoffMs) =>
      invoke<SetProjectRetryPolicyResponse>(IPC_CHANNELS.setProjectRetryPolicy, {
        projectId,
        maxAttempts,
        backoffMs,
      }),
    // platform
    listPlatformStatuses: () => invoke<PlatformInstallStatus[]>(IPC_CHANNELS.listPlatformStatuses),
    listProjectPlatforms: (projectId) =>
      invoke<PlatformId[]>(IPC_CHANNELS.listProjectPlatforms, { projectId }),
    // analytics reads
    getAgentActivityOverTime: (timeRange, projectId) =>
      invoke<AgentActivityOverTimeResponse>(IPC_CHANNELS.getAgentActivityOverTime, {
        timeRange,
        projectId: projectId ?? null,
      }),
  };
}

let cachedClient: OpenSymphonyDesktopApi | null = null;

export function getIpcClient(): OpenSymphonyDesktopApi {
  if (!isIpcAvailable()) {
    throw new IpcUnavailableError();
  }
  if (!cachedClient) {
    cachedClient = createIpcClient();
  }
  return cachedClient;
}

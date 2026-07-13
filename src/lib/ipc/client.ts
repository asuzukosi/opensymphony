import type { CreateProjectInput } from "@/lib/create-project-form";
import { IPC_CHANNELS } from "@/lib/ipc/channels";
import type {
  ActivityTimeRange,
  AddIssueCommentResponse,
  AgentActivityOverTimeResponse,
  AttachIssueFilesResponse,
  BoardColumnId,
  CreateIssueResponse,
  CreateProjectResponse,
  IssueComment,
  IssueDetailRunAttempt,
  IssueHeader,
  PendingPermission,
  PermissionDecision,
  PlatformId,
  PlatformInstallStatus,
  ProjectIssueListItem,
  ProjectSummary,
  RetryPolicy,
  RuntimeRecentFinishedEntry,
  RuntimeRetryEntry,
  RuntimeRunningEntry,
  SessionEvent,
  SetIssueAutoApprovePermissionsResponse,
  SetIssueExecutorResponse,
  SetIssueTagsResponse,
  SetProjectMaxConcurrencyResponse,
  SetProjectNameResponse,
  SetProjectRetryPolicyResponse,
  TransitionIssueColumnResponse,
  UpdateIssuePriorityResponse,
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
  // issue reads
  getIssueHeader(issueId: string): Promise<IssueHeader>;
  listProjectIssues(projectId: string): Promise<ProjectIssueListItem[]>;
  listIssueComments(issueId: string): Promise<IssueComment[]>;
  listIssueRunAttempts(issueId: string): Promise<IssueDetailRunAttempt[]>;
  listSessionEvents(issueId: string): Promise<SessionEvent[]>;
  // issue writes
  createIssue(
    projectId: string,
    title: string,
    description?: string | null,
    executor?: PlatformId | null,
    priority?: number | null,
    tags?: string[],
  ): Promise<CreateIssueResponse>;
  setIssueExecutor(
    issueId: string,
    executor?: PlatformId | null,
  ): Promise<SetIssueExecutorResponse>;
  setIssueAutoApprovePermissions(
    issueId: string,
    autoApprovePermissions: boolean,
  ): Promise<SetIssueAutoApprovePermissionsResponse>;
  setIssueTags(issueId: string, tags: string[]): Promise<SetIssueTagsResponse>;
  attachIssueFiles(issueId: string, sourcePaths: string[]): Promise<AttachIssueFilesResponse>;
  updateIssuePriority(
    issueId: string,
    priority?: number | null,
  ): Promise<UpdateIssuePriorityResponse>;
  transitionIssueColumn(
    issueId: string,
    column: BoardColumnId,
    actor?: string | null,
  ): Promise<TransitionIssueColumnResponse>;
  addIssueComment(
    issueId: string,
    body: string,
    author?: string | null,
  ): Promise<AddIssueCommentResponse>;
  // permissions reads
  listIssuePendingPermissions(issueId: string): Promise<PendingPermission[]>;
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
    // issue reads
    getIssueHeader: (issueId) => invoke<IssueHeader>(IPC_CHANNELS.getIssueHeader, { issueId }),
    listProjectIssues: (projectId) =>
      invoke<ProjectIssueListItem[]>(IPC_CHANNELS.listProjectIssues, { projectId }),
    listIssueComments: (issueId) =>
      invoke<IssueComment[]>(IPC_CHANNELS.listIssueComments, { issueId }),
    listIssueRunAttempts: (issueId) =>
      invoke<IssueDetailRunAttempt[]>(IPC_CHANNELS.listIssueRunAttempts, { issueId }),
    listSessionEvents: (issueId) =>
      invoke<SessionEvent[]>(IPC_CHANNELS.listSessionEvents, { issueId }),
    // issue writes
    createIssue: (projectId, title, description, executor, priority, tags) =>
      invoke<CreateIssueResponse>(IPC_CHANNELS.createIssue, {
        projectId,
        title,
        description: description ?? null,
        executor: executor ?? null,
        priority: priority ?? null,
        tags: tags ?? [],
      }),
    setIssueExecutor: (issueId, executor) =>
      invoke<SetIssueExecutorResponse>(IPC_CHANNELS.setIssueExecutor, {
        issueId,
        executor: executor ?? null,
      }),
    setIssueAutoApprovePermissions: (issueId, autoApprovePermissions) =>
      invoke<SetIssueAutoApprovePermissionsResponse>(IPC_CHANNELS.setIssueAutoApprovePermissions, {
        issueId,
        autoApprovePermissions,
      }),
    setIssueTags: (issueId, tags) =>
      invoke<SetIssueTagsResponse>(IPC_CHANNELS.setIssueTags, { issueId, tags }),
    attachIssueFiles: (issueId, sourcePaths) =>
      invoke<AttachIssueFilesResponse>(IPC_CHANNELS.attachIssueFiles, {
        issueId,
        sourcePaths,
      }),
    updateIssuePriority: (issueId, priority) =>
      invoke<UpdateIssuePriorityResponse>(IPC_CHANNELS.updateIssuePriority, {
        issueId,
        priority: priority ?? null,
      }),
    transitionIssueColumn: (issueId, column, actor) =>
      invoke<TransitionIssueColumnResponse>(IPC_CHANNELS.transitionIssueColumn, {
        issueId,
        column,
        actor: actor ?? null,
      }),
    addIssueComment: (issueId, body, author) =>
      invoke<AddIssueCommentResponse>(IPC_CHANNELS.addIssueComment, {
        issueId,
        body,
        author: author ?? null,
      }),
    // permissions reads
    listIssuePendingPermissions: (issueId) =>
      invoke<PendingPermission[]>(IPC_CHANNELS.listIssuePendingPermissions, { issueId }),
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

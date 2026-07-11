import { invoke, isTauri } from "@tauri-apps/api/core";
import type { CreateProjectInput } from "@/lib/create-project-form";
import { IPC_CHANNELS } from "@/lib/ipc/channels";
import type {
  ActivityTimeRange,
  AddIssueCommentResponse,
  Agent,
  AgentActivityOverTimeResponse,
  AgentSummary,
  BoardColumn,
  BoardColumnId,
  ClearRuntimePollIntervalOverrideResponse,
  CreateAgentResponse,
  CreateIssueResponse,
  CreateProjectResponse,
  IssueComment,
  IssueDetailRunAttempt,
  IssueFile,
  IssueHeader,
  PendingPermission,
  PermissionActivityOverTimeResponse,
  PermissionDecision,
  PermissionMode,
  PlatformId,
  PlatformInstallStatus,
  ProjectBoardIssue,
  ProjectSummary,
  RetryPolicy,
  RuntimeAuditEvent,
  RuntimeCandidateEntry,
  RuntimeRecentFinishedEntry,
  RuntimeRetryEntry,
  RuntimeRunningEntry,
  RuntimeSummary,
  SessionEvent,
  SetActiveProjectIdResponse,
  SetAgentAcpCommandResponse,
  SetAgentNameResponse,
  SetProjectMaxConcurrencyResponse,
  SetProjectNameResponse,
  SetProjectPermissionModeResponse,
  SetProjectPollIntervalResponse,
  SetProjectPromptTemplateResponse,
  SetProjectRetryPolicyResponse,
  SetProjectWorkflowFileResponse,
  SetRuntimePollIntervalResponse,
  AttachIssueFilesResponse,
  SetIssueExecutorResponse,
  SetIssueTagsResponse,
  StartRuntimeResponse,
  StopRuntimeResponse,
  TickRuntimeResponse,
  TransitionIssueColumnResponse,
  UpdateIssueDescriptionResponse,
  UpdateIssuePriorityResponse,
  UpdateIssueTitleResponse,
} from "@/lib/ipc/types";

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
  // board reads
  getBoardColumn(projectId: string, column: BoardColumnId): Promise<BoardColumn>;
  getBoardIssueCard(issueId: string): Promise<ProjectBoardIssue>;
  // issue reads
  getIssueHeader(issueId: string): Promise<IssueHeader>;
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
  setIssueTags(issueId: string, tags: string[]): Promise<SetIssueTagsResponse>;
  attachIssueFiles(issueId: string, sourcePaths: string[]): Promise<AttachIssueFilesResponse>;
  updateIssueTitle(issueId: string, title: string): Promise<UpdateIssueTitleResponse>;
  updateIssueDescription(
    issueId: string,
    description?: string | null,
  ): Promise<UpdateIssueDescriptionResponse>;
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
  resolveSessionPermission(
    permissionId: string,
    decision: PermissionDecision,
  ): Promise<void>;
  // runtime reads
  getRuntimeSummary(projectId: string): Promise<RuntimeSummary>;
  getRuntimeRunning(projectId: string): Promise<RuntimeRunningEntry[]>;
  getRuntimeRetrying(projectId: string): Promise<RuntimeRetryEntry[]>;
  getRuntimeCandidates(projectId: string): Promise<RuntimeCandidateEntry[]>;
  getRuntimeRecentFinished(projectId: string): Promise<RuntimeRecentFinishedEntry[]>;
  getRuntimeRecentEvents(projectId: string): Promise<RuntimeAuditEvent[]>;
  // runtime writes
  startRuntime(projectId: string): Promise<StartRuntimeResponse>;
  stopRuntime(projectId: string): Promise<StopRuntimeResponse>;
  tickRuntime(projectId: string): Promise<TickRuntimeResponse>;
  setRuntimePollInterval(
    projectId: string,
    pollIntervalMs: number,
  ): Promise<SetRuntimePollIntervalResponse>;
  clearRuntimePollIntervalOverride(
    projectId: string,
  ): Promise<ClearRuntimePollIntervalOverrideResponse>;
  pauseRun(projectId: string, runAttemptId: string): Promise<void>;
  resumeRun(projectId: string, runAttemptId: string): Promise<void>;
  cancelRun(projectId: string, runAttemptId: string): Promise<void>;
  // project reads
  listProjectSummaries(): Promise<ProjectSummary[]>;
  getProjectName(projectId: string): Promise<string>;
  getProjectWorkflowSource(projectId: string): Promise<string | null>;
  getProjectWorkflowFilePath(projectId: string): Promise<string | null>;
  getProjectWorkflowVersion(projectId: string): Promise<string | null>;
  getProjectPromptTemplate(projectId: string): Promise<string>;
  getProjectPollInterval(projectId: string): Promise<number>;
  getProjectMaxConcurrency(projectId: string): Promise<number>;
  getProjectRetryPolicy(projectId: string): Promise<RetryPolicy>;
  getProjectPermissionMode(projectId: string): Promise<PermissionMode>;
  getProjectOrchestratorStatus(projectId: string): Promise<string>;
  // project writes
  createProject(input: CreateProjectInput): Promise<CreateProjectResponse>;
  deleteProject(projectId: string): Promise<void>;
  setProjectName(projectId: string, name: string): Promise<SetProjectNameResponse>;
  setProjectWorkflowFile(
    projectId: string,
    sourcePath: string,
  ): Promise<SetProjectWorkflowFileResponse>;
  importProjectWorkflowFile(
    projectId: string,
    sourcePath: string,
  ): Promise<SetProjectWorkflowFileResponse>;
  setProjectPromptTemplate(
    projectId: string,
    promptTemplate: string,
  ): Promise<SetProjectPromptTemplateResponse>;
  setProjectPollInterval(
    projectId: string,
    pollIntervalMs: number,
  ): Promise<SetProjectPollIntervalResponse>;
  setProjectMaxConcurrency(
    projectId: string,
    maxConcurrency: number,
  ): Promise<SetProjectMaxConcurrencyResponse>;
  setProjectRetryPolicy(
    projectId: string,
    maxAttempts: number,
    backoffMs: number,
  ): Promise<SetProjectRetryPolicyResponse>;
  setProjectPermissionMode(
    projectId: string,
    permissionMode: PermissionMode,
  ): Promise<SetProjectPermissionModeResponse>;
  // agent reads
  listAgentSummaries(): Promise<AgentSummary[]>;
  getAgent(agentId: string): Promise<Agent>;
  listProjectAgentIds(projectId: string): Promise<string[]>;
  // agent writes
  createAgent(name: string, acpCommand?: string | null): Promise<CreateAgentResponse>;
  deleteAgent(agentId: string): Promise<void>;
  setAgentName(agentId: string, name: string): Promise<SetAgentNameResponse>;
  setAgentAcpCommand(
    agentId: string,
    acpCommand?: string | null,
  ): Promise<SetAgentAcpCommandResponse>;
  assignAgentToProject(projectId: string, agentId: string): Promise<void>;
  unassignAgentFromProject(projectId: string, agentId: string): Promise<void>;
  // platform
  listAgentPlatformStatuses(): Promise<PlatformInstallStatus[]>;
  listProjectPlatforms(projectId: string): Promise<PlatformId[]>;
  // analytics reads
  getProjectAgentActivityOverTime(
    projectId: string,
    timeRange: ActivityTimeRange,
  ): Promise<AgentActivityOverTimeResponse>;
  getProjectPermissionActivityOverTime(
    projectId: string,
    timeRange: ActivityTimeRange,
  ): Promise<PermissionActivityOverTimeResponse>;
  // app state reads
  getActiveProjectId(): Promise<string | null>;
  // app state writes
  setActiveProjectId(projectId?: string | null): Promise<SetActiveProjectIdResponse>;
}

function createIpcClient(): OpenSymphonyDesktopApi {
  return {
    // board reads
    getBoardColumn: (projectId, column) =>
      invoke<BoardColumn>(IPC_CHANNELS.getBoardColumn, { projectId, column }),
    getBoardIssueCard: (issueId) =>
      invoke<ProjectBoardIssue>(IPC_CHANNELS.getBoardIssueCard, { issueId }),
    // issue reads
    getIssueHeader: (issueId) =>
      invoke<IssueHeader>(IPC_CHANNELS.getIssueHeader, { issueId }),
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
    setIssueTags: (issueId, tags) =>
      invoke<SetIssueTagsResponse>(IPC_CHANNELS.setIssueTags, { issueId, tags }),
    attachIssueFiles: (issueId, sourcePaths) =>
      invoke<AttachIssueFilesResponse>(IPC_CHANNELS.attachIssueFiles, {
        issueId,
        sourcePaths,
      }),
    updateIssueTitle: (issueId, title) =>
      invoke<UpdateIssueTitleResponse>(IPC_CHANNELS.updateIssueTitle, { issueId, title }),
    updateIssueDescription: (issueId, description) =>
      invoke<UpdateIssueDescriptionResponse>(IPC_CHANNELS.updateIssueDescription, {
        issueId,
        description: description ?? null,
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
    getRuntimeSummary: (projectId) =>
      invoke<RuntimeSummary>(IPC_CHANNELS.getRuntimeSummary, { projectId }),
    getRuntimeRunning: (projectId) =>
      invoke<RuntimeRunningEntry[]>(IPC_CHANNELS.getRuntimeRunning, { projectId }),
    getRuntimeRetrying: (projectId) =>
      invoke<RuntimeRetryEntry[]>(IPC_CHANNELS.getRuntimeRetrying, { projectId }),
    getRuntimeCandidates: (projectId) =>
      invoke<RuntimeCandidateEntry[]>(IPC_CHANNELS.getRuntimeCandidates, { projectId }),
    getRuntimeRecentFinished: (projectId) =>
      invoke<RuntimeRecentFinishedEntry[]>(IPC_CHANNELS.getRuntimeRecentFinished, {
        projectId,
      }),
    getRuntimeRecentEvents: (projectId) =>
      invoke<RuntimeAuditEvent[]>(IPC_CHANNELS.getRuntimeRecentEvents, { projectId }),
    // runtime writes
    startRuntime: (projectId) =>
      invoke<StartRuntimeResponse>(IPC_CHANNELS.startRuntime, { projectId }),
    stopRuntime: (projectId) =>
      invoke<StopRuntimeResponse>(IPC_CHANNELS.stopRuntime, { projectId }),
    tickRuntime: (projectId) =>
      invoke<TickRuntimeResponse>(IPC_CHANNELS.tickRuntime, { projectId }),
    setRuntimePollInterval: (projectId, pollIntervalMs) =>
      invoke<SetRuntimePollIntervalResponse>(IPC_CHANNELS.setRuntimePollInterval, {
        projectId,
        pollIntervalMs,
      }),
    clearRuntimePollIntervalOverride: (projectId) =>
      invoke<ClearRuntimePollIntervalOverrideResponse>(
        IPC_CHANNELS.clearRuntimePollIntervalOverride,
        { projectId },
      ),
    pauseRun: (projectId, runAttemptId) =>
      invoke<void>(IPC_CHANNELS.pauseRun, { projectId, runAttemptId }),
    resumeRun: (projectId, runAttemptId) =>
      invoke<void>(IPC_CHANNELS.resumeRun, { projectId, runAttemptId }),
    cancelRun: (projectId, runAttemptId) =>
      invoke<void>(IPC_CHANNELS.cancelRun, { projectId, runAttemptId }),
    // project reads
    listProjectSummaries: () =>
      invoke<ProjectSummary[]>(IPC_CHANNELS.listProjectSummaries),
    getProjectName: (projectId) =>
      invoke<string>(IPC_CHANNELS.getProjectName, { projectId }),
    getProjectWorkflowSource: (projectId) =>
      invoke<string | null>(IPC_CHANNELS.getProjectWorkflowSource, { projectId }),
    getProjectWorkflowFilePath: (projectId) =>
      invoke<string | null>(IPC_CHANNELS.getProjectWorkflowFilePath, { projectId }),
    getProjectWorkflowVersion: (projectId) =>
      invoke<string | null>(IPC_CHANNELS.getProjectWorkflowVersion, { projectId }),
    getProjectPromptTemplate: (projectId) =>
      invoke<string>(IPC_CHANNELS.getProjectPromptTemplate, { projectId }),
    getProjectPollInterval: (projectId) =>
      invoke<number>(IPC_CHANNELS.getProjectPollInterval, { projectId }),
    getProjectMaxConcurrency: (projectId) =>
      invoke<number>(IPC_CHANNELS.getProjectMaxConcurrency, { projectId }),
    getProjectRetryPolicy: (projectId) =>
      invoke<RetryPolicy>(IPC_CHANNELS.getProjectRetryPolicy, { projectId }),
    getProjectPermissionMode: (projectId) =>
      invoke<PermissionMode>(IPC_CHANNELS.getProjectPermissionMode, { projectId }),
    getProjectOrchestratorStatus: (projectId) =>
      invoke<string>(IPC_CHANNELS.getProjectOrchestratorStatus, { projectId }),
    // project writes
    createProject: (input) =>
      invoke<CreateProjectResponse>(IPC_CHANNELS.createProject, { input }),
    deleteProject: (projectId) => invoke<void>(IPC_CHANNELS.deleteProject, { projectId }),
    setProjectName: (projectId, name) =>
      invoke<SetProjectNameResponse>(IPC_CHANNELS.setProjectName, { projectId, name }),
    setProjectWorkflowFile: (projectId, sourcePath) =>
      invoke<SetProjectWorkflowFileResponse>(IPC_CHANNELS.setProjectWorkflowFile, {
        projectId,
        sourcePath,
      }),
    importProjectWorkflowFile: (projectId, sourcePath) =>
      invoke<SetProjectWorkflowFileResponse>(IPC_CHANNELS.importProjectWorkflowFile, {
        projectId,
        sourcePath,
      }),
    setProjectPromptTemplate: (projectId, promptTemplate) =>
      invoke<SetProjectPromptTemplateResponse>(IPC_CHANNELS.setProjectPromptTemplate, {
        projectId,
        promptTemplate,
      }),
    setProjectPollInterval: (projectId, pollIntervalMs) =>
      invoke<SetProjectPollIntervalResponse>(IPC_CHANNELS.setProjectPollInterval, {
        projectId,
        pollIntervalMs,
      }),
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
    setProjectPermissionMode: (projectId, permissionMode) =>
      invoke<SetProjectPermissionModeResponse>(IPC_CHANNELS.setProjectPermissionMode, {
        projectId,
        permissionMode,
      }),
    // agent reads
    listAgentSummaries: () => invoke<AgentSummary[]>(IPC_CHANNELS.listAgentSummaries),
    getAgent: (agentId) => invoke<Agent>(IPC_CHANNELS.getAgent, { agentId }),
    listProjectAgentIds: (projectId) =>
      invoke<string[]>(IPC_CHANNELS.listProjectAgentIds, { projectId }),
    // agent writes
    createAgent: (name, acpCommand) =>
      invoke<CreateAgentResponse>(IPC_CHANNELS.createAgent, {
        name,
        acpCommand: acpCommand ?? null,
      }),
    deleteAgent: (agentId) => invoke<void>(IPC_CHANNELS.deleteAgent, { agentId }),
    setAgentName: (agentId, name) =>
      invoke<SetAgentNameResponse>(IPC_CHANNELS.setAgentName, { agentId, name }),
    setAgentAcpCommand: (agentId, acpCommand) =>
      invoke<SetAgentAcpCommandResponse>(IPC_CHANNELS.setAgentAcpCommand, {
        agentId,
        acpCommand: acpCommand ?? null,
      }),
    assignAgentToProject: (projectId, agentId) =>
      invoke<void>(IPC_CHANNELS.assignAgentToProject, { projectId, agentId }),
    unassignAgentFromProject: (projectId, agentId) =>
      invoke<void>(IPC_CHANNELS.unassignAgentFromProject, { projectId, agentId }),
    // platform
    listAgentPlatformStatuses: () =>
      invoke<PlatformInstallStatus[]>(IPC_CHANNELS.listAgentPlatformStatuses),
    listProjectPlatforms: (projectId) =>
      invoke<PlatformId[]>(IPC_CHANNELS.listProjectPlatforms, { projectId }),
    // analytics reads
    getProjectAgentActivityOverTime: (projectId, timeRange) =>
      invoke<AgentActivityOverTimeResponse>(IPC_CHANNELS.getProjectAgentActivityOverTime, {
        projectId,
        timeRange,
      }),
    getProjectPermissionActivityOverTime: (projectId, timeRange) =>
      invoke<PermissionActivityOverTimeResponse>(
        IPC_CHANNELS.getProjectPermissionActivityOverTime,
        { projectId, timeRange },
      ),
    // app state reads
    getActiveProjectId: () => invoke<string | null>(IPC_CHANNELS.getActiveProjectId),
    // app state writes
    setActiveProjectId: (projectId) =>
      invoke<SetActiveProjectIdResponse>(IPC_CHANNELS.setActiveProjectId, {
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

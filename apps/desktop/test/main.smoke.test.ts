import { describe, expect, test, vi, beforeEach } from "vitest";
import { IPC_CHANNELS } from "@/ipc";

const browserWindowCtor = vi.fn().mockImplementation(() => ({
  loadFile: vi.fn(),
}));

const ipcHandle = vi.fn();

const getRuntimeStateMock = vi.fn(async () => ({
  generatedAt: "2026-05-26T00:00:00.000Z",
  status: "idle",
  workflowPath: "/tmp/WORKFLOW.md",
  workflowVersion: null,
  workflowLastReloadedAt: null,
  startedAt: null,
  pollIntervalMs: 30_000,
  pollIntervalSource: "workflow",
  nextTickAt: null,
  tickCount: 0,
  lastTickAt: null,
  lastDispatchedCount: 0,
  lastDeferredCount: 0,
  lastCancelledCount: 0,
  lastAction: null,
  lastError: null,
  validationError: null,
  counts: { running: 0, retrying: 0, candidates: 0 },
  agentTotals: { activeSessions: 0 },
  running: [],
  retrying: [],
  candidates: [],
  recentEvents: [],
  recentFinished: [],
}));

const getProjectBoardMock = vi.fn(async () => ({
  columns: [
    {
      stateId: "symphony-local:todo",
      stateName: "Todo",
      issues: [],
    },
  ],
}));

const getIssueMock = vi.fn(async () => ({
  issueId: "i1",
  projectId: "symphony-local",
  identifier: "SYM-1",
  title: "Detail issue",
  description: null,
  priority: null,
  workflowStateId: "symphony-local:todo",
  workflowStateName: "Todo",
  comments: [],
  attempts: [],
}));

const mutateIssueMock = vi.fn();
const getPendingPermissionsMock = vi.fn(async () => []);
const resolvePermissionMock = vi.fn(async () => undefined);

const getSettingsMock = vi.fn(async () => ({
  status: "idle",
    workflowPath: "/tmp/WORKFLOW.md",
    workflowVersion: null,
    promptTemplate: "Run the issue.",
  pollIntervalMs: 30_000,
  pollIntervalSource: "workflow",
  permissionMode: "auto_approve",
  permissionModeSource: "workflow",
  project: {
    id: "symphony-local",
    name: "symphony-local",
    slug: "symphony-local",
  },
  acp: {
    command: process.execPath,
    args: ["/tmp/demo-acp-server.mjs"],
  },
  startedAt: null,
  nextTickAt: null,
  tickCount: 0,
  lastTickAt: null,
  lastAction: null,
  lastError: null,
}));

const controlRuntimeMock = vi.fn(async () => ({
  generatedAt: "2026-05-26T00:00:00.000Z",
  status: "running",
  workflowPath: "/tmp/WORKFLOW.md",
  workflowVersion: null,
  workflowLastReloadedAt: null,
  startedAt: "2026-05-26T00:00:00.000Z",
  pollIntervalMs: 30_000,
  pollIntervalSource: "workflow",
  nextTickAt: null,
  tickCount: 1,
  lastTickAt: "2026-05-26T00:00:01.000Z",
  lastDispatchedCount: 0,
  lastDeferredCount: 0,
  lastCancelledCount: 0,
  lastAction: "tick_completed",
  lastError: null,
  validationError: null,
  counts: { running: 0, retrying: 0, candidates: 0 },
  agentTotals: { activeSessions: 0 },
  running: [],
  retrying: [],
  candidates: [],
  recentEvents: [],
  recentFinished: [],
}));

vi.mock("electron", () => ({
  app: {
    getName: vi.fn(() => "Symphony"),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn(),
  },
  BrowserWindow: Object.assign(browserWindowCtor, {
    getAllWindows: vi.fn(() => [1]),
  }),
  ipcMain: {
    handle: ipcHandle,
  },
}));

vi.mock("../src/orchestrator-runtime", () => ({
  getRuntimeState: getRuntimeStateMock,
  getProjectBoard: getProjectBoardMock,
  getIssue: getIssueMock,
  mutateIssue: mutateIssueMock,
  controlRuntime: controlRuntimeMock,
  getSettings: getSettingsMock,
  getPendingPermissions: getPendingPermissionsMock,
  resolvePermission: resolvePermissionMock,
  runOrchestratorTick: vi.fn(),
  startOrchestratorRuntime: vi.fn(),
  stopOrchestratorRuntime: vi.fn(),
}));

const EXPECTED_CHANNELS = [
  IPC_CHANNELS.getRuntimeState,
  IPC_CHANNELS.getProjectBoard,
  IPC_CHANNELS.getIssue,
  IPC_CHANNELS.mutateIssue,
  IPC_CHANNELS.controlRuntime,
  IPC_CHANNELS.getSettings,
  IPC_CHANNELS.getPendingPermissions,
  IPC_CHANNELS.resolvePermission,
] as const;

function registerHandlersAndFind(channel: string) {
  ipcHandle.mockClear();
  return import("../src/main").then(({ registerIpcHandlers }) => {
    registerIpcHandlers();
    const call = ipcHandle.mock.calls.find(([registeredChannel]) => registeredChannel === channel);
    expect(call).toBeDefined();
    return call![1] as (...args: unknown[]) => Promise<unknown>;
  });
}

describe("desktop bootstrap smoke", () => {
  beforeEach(() => {
    ipcHandle.mockClear();
  });

  test("creates a BrowserWindow with secure webPreferences", async () => {
    const { createMainWindow } = await import("../src/main");
    createMainWindow();

    expect(browserWindowCtor).toHaveBeenCalledTimes(1);
    const options = browserWindowCtor.mock.calls[0][0] as {
      webPreferences: Record<string, unknown>;
    };

    expect(options.webPreferences.contextIsolation).toBe(true);
    expect(options.webPreferences.nodeIntegration).toBe(false);
    expect(options.webPreferences.sandbox).toBe(false);
  });

  test("registers exactly eight IPC handlers with slim channel names", async () => {
    const { registerIpcHandlers } = await import("../src/main");
    registerIpcHandlers();

    expect(ipcHandle).toHaveBeenCalledTimes(8);

    const registeredChannels = ipcHandle.mock.calls.map(([channel]) => channel);
    expect(registeredChannels.sort()).toEqual([...EXPECTED_CHANNELS].sort());
  });

  test("getRuntimeState handler delegates to orchestrator runtime", async () => {
    getRuntimeStateMock.mockClear();
    const handler = await registerHandlersAndFind(IPC_CHANNELS.getRuntimeState);

    const snapshot = await handler({}, 15);

    expect(getRuntimeStateMock).toHaveBeenCalledWith(15);
    expect(snapshot).toMatchObject({
      counts: { running: 0, retrying: 0, candidates: 0 },
      agentTotals: { activeSessions: 0 },
      validationError: null,
    });
  });

  test("getProjectBoard handler delegates to orchestrator runtime", async () => {
    getProjectBoardMock.mockClear();
    const handler = await registerHandlersAndFind(IPC_CHANNELS.getProjectBoard);

    const board = await handler({});

    expect(getProjectBoardMock).toHaveBeenCalledTimes(1);
    expect(board).toMatchObject({
      columns: [{ stateId: "symphony-local:todo", stateName: "Todo", issues: [] }],
    });
  });

  test("getIssue handler delegates to orchestrator runtime", async () => {
    getIssueMock.mockClear();
    const handler = await registerHandlersAndFind(IPC_CHANNELS.getIssue);

    const detail = await handler({}, "i1", 10);

    expect(getIssueMock).toHaveBeenCalledWith("i1", 10);
    expect(detail).toMatchObject({
      issueId: "i1",
      workflowStateName: "Todo",
      comments: [],
      attempts: [],
    });
  });

  test("mutateIssue handler delegates to orchestrator runtime", async () => {
    mutateIssueMock.mockClear();
    const handler = await registerHandlersAndFind(IPC_CHANNELS.mutateIssue);
    const request = {
      action: "comment" as const,
      issueId: "i1",
      body: "ship it",
    };

    await handler({}, request);

    expect(mutateIssueMock).toHaveBeenCalledWith(request);
  });

  test("controlRuntime handler delegates to orchestrator runtime", async () => {
    controlRuntimeMock.mockClear();
    const handler = await registerHandlersAndFind(IPC_CHANNELS.controlRuntime);

    const snapshot = await handler({}, { action: "tick" });

    expect(controlRuntimeMock).toHaveBeenCalledWith({ action: "tick" });
    expect(snapshot).toMatchObject({
      status: "running",
      tickCount: 1,
      counts: { running: 0, retrying: 0, candidates: 0 },
    });
  });

  test("getSettings handler delegates to orchestrator runtime", async () => {
    getSettingsMock.mockClear();
    const handler = await registerHandlersAndFind(IPC_CHANNELS.getSettings);

    const settings = await handler({});

    expect(getSettingsMock).toHaveBeenCalledTimes(1);
    expect(settings).toMatchObject({
      workflowPath: "/tmp/WORKFLOW.md",
      pollIntervalMs: 30_000,
      project: { id: "symphony-local", slug: "symphony-local" },
      acp: { command: process.execPath },
    });
  });

  test("getPendingPermissions handler delegates to orchestrator runtime", async () => {
    getPendingPermissionsMock.mockClear();
    const handler = await registerHandlersAndFind(IPC_CHANNELS.getPendingPermissions);

    const pending = await handler({});

    expect(getPendingPermissionsMock).toHaveBeenCalledTimes(1);
    expect(pending).toEqual([]);
  });

  test("resolvePermission handler delegates to orchestrator runtime", async () => {
    resolvePermissionMock.mockClear();
    const handler = await registerHandlersAndFind(IPC_CHANNELS.resolvePermission);
    const request = { id: "perm-1", decision: "approve" as const };

    await handler({}, request);

    expect(resolvePermissionMock).toHaveBeenCalledWith(request);
  });
});

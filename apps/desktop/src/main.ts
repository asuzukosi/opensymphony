import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  IPC_CHANNELS,
  type IssueRunHistory,
  type OrchestratorAuditEvent,
  type OrchestratorIssueQueues,
  type OrchestratorSnapshot,
  type OrchestratorStatus,
  type SystemInfo,
} from "@/ipc";
import {
  addIssueComment,
  clearOrchestratorPollIntervalOverride,
  getIssueRunHistory,
  getRecentAuditEvents,
  getOrchestratorIssueQueues,
  getOrchestratorSnapshot,
  getOrchestratorStatus as getRuntimeOrchestratorStatus,
  runOrchestratorTick,
  setOrchestratorPollIntervalMs,
  startOrchestratorRuntime,
  stopOrchestratorRuntime,
  transitionIssue,
} from "@/orchestrator-runtime";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getSystemInfo, async (): Promise<SystemInfo> => {
    return {
      appName: app.getName(),
      platform: process.platform,
    };
  });

  ipcMain.handle(IPC_CHANNELS.getOrchestratorStatus, async (): Promise<OrchestratorStatus> => {
    return getRuntimeOrchestratorStatus();
  });

  ipcMain.handle(IPC_CHANNELS.getOrchestratorSnapshot, async (): Promise<OrchestratorSnapshot> => {
    return getOrchestratorSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.getOrchestratorIssueQueues,
    async (): Promise<OrchestratorIssueQueues> => {
      return getOrchestratorIssueQueues();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getRecentAuditEvents,
    async (_event, limit?: number): Promise<OrchestratorAuditEvent[]> => {
      return getRecentAuditEvents(limit ?? 20);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getIssueRunHistory,
    async (_event, issueId: string, limit?: number): Promise<IssueRunHistory> => {
      return getIssueRunHistory(issueId, limit ?? 20);
    },
  );

  ipcMain.handle(IPC_CHANNELS.startOrchestratorRuntime, async (): Promise<OrchestratorSnapshot> => {
    startOrchestratorRuntime();
    return getOrchestratorSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.stopOrchestratorRuntime, async (): Promise<OrchestratorSnapshot> => {
    stopOrchestratorRuntime();
    return getOrchestratorSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.runOrchestratorTick, async (): Promise<OrchestratorSnapshot> => {
    runOrchestratorTick();
    return getOrchestratorSnapshot();
  });

  ipcMain.handle(
    IPC_CHANNELS.setOrchestratorPollIntervalMs,
    async (_event, pollIntervalMs: number): Promise<OrchestratorSnapshot> => {
      setOrchestratorPollIntervalMs(pollIntervalMs);
      return getOrchestratorSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.clearOrchestratorPollIntervalOverride,
    async (): Promise<OrchestratorSnapshot> => {
      clearOrchestratorPollIntervalOverride();
      return getOrchestratorSnapshot();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.transitionIssue,
    async (_event, issueId: string, targetStateId: string, actor?: string): Promise<void> => {
      transitionIssue(issueId, targetStateId, actor);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.addIssueComment,
    async (_event, issueId: string, body: string, authorId?: string): Promise<void> => {
      addIssueComment(issueId, body, authorId);
    },
  );
}

export function createMainWindow(): BrowserWindow {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const preloadPath = devServerUrl
    ? path.join(__dirname, "preload.cjs")
    : path.join(__dirname, "preload.js");

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, "renderer", "index.html"));
  }
  mainWindow = win;
  return win;
}

export function bootstrap(): void {
  registerIpcHandlers();

  app.whenReady().then(() => {
    createMainWindow();
    startOrchestratorRuntime();
    runOrchestratorTick();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      stopOrchestratorRuntime();
      app.quit();
    }
  });
}

function isDirectEntryExecution(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const invokedPath = process.argv[1];
  if (!invokedPath) return false;
  return path.resolve(invokedPath) === currentFile;
}

if (process.env.SYMPHONY_DESKTOP_BOOTSTRAP === "1" || isDirectEntryExecution()) {
  bootstrap();
}

export function setOrchestratorStatus(status: OrchestratorStatus): void {
  if (status === "running") startOrchestratorRuntime();
  if (status === "stopped") stopOrchestratorRuntime();
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  IPC_CHANNELS,
  type ControlRuntimeRequest,
  type IssueDetail,
  type MutateIssueRequest,
  type PendingPermission,
  type ProjectBoard,
  type ResolvePermissionRequest,
  type RuntimeStateSnapshot,
  type RuntimeStatus,
  type SettingsView,
} from "@/ipc";
import {
  controlRuntime,
  getIssue,
  getPendingPermissions,
  getProjectBoard,
  getRuntimeState,
  getSettings,
  mutateIssue,
  resolvePermission,
  runOrchestratorTick,
  startOrchestratorRuntime,
  stopOrchestratorRuntime,
} from "@/orchestrator-runtime";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

export function registerIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.getRuntimeState,
    async (_event, eventLimit?: number): Promise<RuntimeStateSnapshot> => {
      return getRuntimeState(eventLimit ?? 20);
    },
  );

  ipcMain.handle(IPC_CHANNELS.getProjectBoard, async (): Promise<ProjectBoard> => {
    return getProjectBoard();
  });

  ipcMain.handle(
    IPC_CHANNELS.getIssue,
    async (_event, issueId: string, attemptLimit?: number): Promise<IssueDetail> => {
      return getIssue(issueId, attemptLimit ?? 20);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.mutateIssue,
    async (_event, request: MutateIssueRequest): Promise<void> => {
      mutateIssue(request);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.controlRuntime,
    async (_event, request: ControlRuntimeRequest): Promise<RuntimeStateSnapshot> => {
      return controlRuntime(request);
    },
  );

  ipcMain.handle(IPC_CHANNELS.getSettings, async (): Promise<SettingsView> => {
    return getSettings();
  });

  ipcMain.handle(
    IPC_CHANNELS.getPendingPermissions,
    async (): Promise<PendingPermission[]> => {
      return getPendingPermissions();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.resolvePermission,
    async (_event, request: ResolvePermissionRequest): Promise<void> => {
      resolvePermission(request);
    },
  );
}

export function createMainWindow(): BrowserWindow {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const preloadPath = path.join(__dirname, "preload.js");

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
  nativeTheme.themeSource = "dark";

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

export function setOrchestratorStatus(status: RuntimeStatus): void {
  if (status === "running") startOrchestratorRuntime();
  if (status === "stopped") stopOrchestratorRuntime();
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

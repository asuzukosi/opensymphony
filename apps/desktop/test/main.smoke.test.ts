import { describe, expect, test, vi } from "vitest";

const browserWindowCtor = vi.fn().mockImplementation(() => ({
  loadFile: vi.fn(),
}));

const ipcHandle = vi.fn();

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

describe("desktop bootstrap smoke", () => {
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

  test("registers typed IPC handlers", async () => {
    const { registerIpcHandlers } = await import("../src/main");
    registerIpcHandlers();

    expect(ipcHandle).toHaveBeenCalledTimes(6);
  });
});

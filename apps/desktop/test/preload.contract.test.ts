import { describe, expect, test, vi, beforeEach } from "vitest";
import { IPC_CHANNELS, type SymphonyDesktopApi } from "@/ipc";

const invoke = vi.fn(async (_channel: string) => "ok");
const exposeInMainWorld = vi.fn();

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld,
  },
  ipcRenderer: {
    invoke,
  },
}));

const EXPECTED_METHODS = [
  "getRuntimeState",
  "getProjectBoard",
  "getIssue",
  "mutateIssue",
  "controlRuntime",
  "getSettings",
] as const satisfies ReadonlyArray<keyof SymphonyDesktopApi>;

describe("preload contract", () => {
  beforeEach(() => {
    invoke.mockClear();
    exposeInMainWorld.mockClear();
  });

  test("exposes exactly six symphonyDesktop API methods", async () => {
    const { createDesktopApi } = await import("../src/preload");
    const api = createDesktopApi();

    expect(Object.keys(api).sort()).toEqual([...EXPECTED_METHODS].sort());

    for (const method of EXPECTED_METHODS) {
      expect(typeof api[method]).toBe("function");
    }
  });

  test("registers symphonyDesktop on contextBridge", async () => {
    vi.resetModules();
    exposeInMainWorld.mockClear();

    await import("../src/preload");

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(exposeInMainWorld).toHaveBeenCalledWith(
      "symphonyDesktop",
      expect.objectContaining({
        getRuntimeState: expect.any(Function),
        getProjectBoard: expect.any(Function),
        getIssue: expect.any(Function),
        mutateIssue: expect.any(Function),
        controlRuntime: expect.any(Function),
        getSettings: expect.any(Function),
      }),
    );
  });

  test("getRuntimeState invokes symphony:get-runtime-state with optional event limit", async () => {
    const { createDesktopApi } = await import("../src/preload");
    const api = createDesktopApi();

    await api.getRuntimeState(25);

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.getRuntimeState, 25);
  });

  test("getProjectBoard invokes symphony:get-project-board", async () => {
    const { createDesktopApi } = await import("../src/preload");
    const api = createDesktopApi();

    await api.getProjectBoard();

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.getProjectBoard);
  });

  test("getIssue invokes symphony:get-issue with id and attempt limit", async () => {
    const { createDesktopApi } = await import("../src/preload");
    const api = createDesktopApi();

    await api.getIssue("issue-1", 5);

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.getIssue, "issue-1", 5);
  });

  test("mutateIssue invokes symphony:mutate-issue with request payload", async () => {
    const { createDesktopApi } = await import("../src/preload");
    const api = createDesktopApi();
    const request = {
      action: "transition" as const,
      issueId: "issue-1",
      targetStateId: "p1:done",
      actor: "operator",
    };

    await api.mutateIssue(request);

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.mutateIssue, request);
  });

  test("controlRuntime invokes symphony:control-runtime with request payload", async () => {
    const { createDesktopApi } = await import("../src/preload");
    const api = createDesktopApi();

    await api.controlRuntime({ action: "tick" });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.controlRuntime, { action: "tick" });
  });

  test("getSettings invokes symphony:get-settings", async () => {
    const { createDesktopApi } = await import("../src/preload");
    const api = createDesktopApi();

    await api.getSettings();

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.getSettings);
  });
});

import { describe, expect, test, vi } from "vitest";

const invoke = vi.fn(async (_channel: string) => "ok");

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    invoke,
  },
}));

describe("preload contract smoke", () => {
  test("exposes API functions that call ipcRenderer.invoke", async () => {
    const { createDesktopApi } = await import("../src/preload");
    const api = createDesktopApi();

    await api.getRuntimeState(10);
    await api.getProjectBoard();
    await api.getIssue("issue-1", 5);
    await api.mutateIssue({
      action: "transition",
      issueId: "issue-1",
      targetStateId: "p1:done",
      actor: "operator",
    });
    await api.controlRuntime({ action: "tick" });
    await api.getSettings();

    expect(invoke).toHaveBeenCalledTimes(6);
  });
});

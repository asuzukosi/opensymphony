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

    await api.getSystemInfo();
    await api.getOrchestratorStatus();
    await api.getOrchestratorSnapshot();
    await api.getOrchestratorIssueQueues();
    await api.getRecentAuditEvents(10);
    await api.getIssueRunHistory("issue-1", 5);
    await api.startOrchestratorRuntime();
    await api.stopOrchestratorRuntime();
    await api.runOrchestratorTick();
    await api.setOrchestratorPollIntervalMs(15000);
    await api.clearOrchestratorPollIntervalOverride();
    await api.transitionIssue("issue-1", "p1:done", "operator");
    await api.addIssueComment("issue-1", "handoff complete", "operator");

    expect(invoke).toHaveBeenCalledTimes(13);
  });
});

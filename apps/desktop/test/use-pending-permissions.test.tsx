// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PendingPermission, SettingsView, SymphonyDesktopApi } from "@/ipc";
import {
  type UsePendingPermissionsResult,
  usePendingPermissions,
} from "@/renderer/hooks/use-pending-permissions";

const { getIpcClient, isIpcAvailable } = vi.hoisted(() => ({
  getIpcClient: vi.fn<() => SymphonyDesktopApi>(),
  isIpcAvailable: vi.fn(() => true),
}));

vi.mock("@/renderer/lib/ipc-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/renderer/lib/ipc-client")>();
  return {
    ...actual,
    getIpcClient,
    isIpcAvailable,
  };
});

function makeSettingsView(overrides: Partial<SettingsView> = {}): SettingsView {
  return {
    status: "idle",
    workflowPath: "/tmp/WORKFLOW.md",
    workflowVersion: "1",
    promptTemplate: "Run the issue.",
    pollIntervalMs: 30_000,
    pollIntervalSource: "workflow",
    permissionMode: "auto_approve",
    permissionModeSource: "workflow",
    project: { id: "symphony-local", name: "symphony-local", slug: "symphony-local" },
    acp: {
      command: "node",
      args: [],
    },
    startedAt: null,
    nextTickAt: null,
    tickCount: 0,
    lastTickAt: null,
    lastAction: null,
    lastError: null,
    ...overrides,
  };
}

function makePermission(overrides: Partial<PendingPermission> = {}): PendingPermission {
  return {
    id: "perm-1",
    sessionId: "session-12345678-abcd",
    issueId: "issue-1",
    summary: "Run tests",
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeMockClient(overrides: Partial<SymphonyDesktopApi> = {}): SymphonyDesktopApi {
  return {
    getRuntimeState: vi.fn(),
    getProjectBoard: vi.fn(),
    getIssue: vi.fn(),
    mutateIssue: vi.fn(),
    controlRuntime: vi.fn(),
    getSettings: vi.fn().mockResolvedValue(makeSettingsView()),
    getPendingPermissions: vi.fn().mockResolvedValue([]),
    resolvePermission: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitFor(
  readResult: () => UsePendingPermissionsResult | null,
  predicate: (result: UsePendingPermissionsResult) => boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await flushMicrotasks();
    const result = readResult();
    if (result != null && predicate(result)) {
      return;
    }
  }
  throw new Error("timed out waiting for hook state");
}

function renderUsePendingPermissions(options?: Parameters<typeof usePendingPermissions>[0]) {
  const state: { current: UsePendingPermissionsResult | null } = { current: null };
  const container = document.createElement("div");
  let root: Root | null = createRoot(container);

  function HookHost() {
    state.current = usePendingPermissions(options);
    return null;
  }

  act(() => {
    root?.render(createElement(HookHost));
  });

  return {
    get result(): UsePendingPermissionsResult | null {
      return state.current;
    },
    unmount() {
      act(() => {
        root?.unmount();
        root = null;
      });
    },
  };
}

describe("usePendingPermissions", () => {
  beforeEach(() => {
    getIpcClient.mockReset();
    isIpcAvailable.mockReset();
    isIpcAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("does not poll pending permissions in auto_approve mode", async () => {
    const mockClient = makeMockClient({
      getSettings: vi.fn().mockResolvedValue(makeSettingsView({ permissionMode: "auto_approve" })),
    });
    getIpcClient.mockReturnValue(mockClient);

    const hook = renderUsePendingPermissions();

    await waitFor(
      () => hook.result,
      (result) => result.isApprovalRequired === false,
    );

    expect(mockClient.getPendingPermissions).not.toHaveBeenCalled();
    expect(hook.result?.permissions).toEqual([]);
    expect(hook.result?.pendingCount).toBe(0);

    hook.unmount();
  });

  test("polls pending permissions when requires_approval mode is active", async () => {
    const permissions = [makePermission()];
    const mockClient = makeMockClient({
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettingsView({ permissionMode: "requires_approval" })),
      getPendingPermissions: vi.fn().mockResolvedValue(permissions),
    });
    getIpcClient.mockReturnValue(mockClient);

    const hook = renderUsePendingPermissions({ pollIntervalMs: 50 });

    await waitFor(
      () => hook.result,
      (result) => result.pendingCount === 1,
    );

    expect(mockClient.getPendingPermissions).toHaveBeenCalledTimes(1);
    expect(hook.result?.permissions).toEqual(permissions);
    expect(hook.result?.isApprovalRequired).toBe(true);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(mockClient.getPendingPermissions).toHaveBeenCalledTimes(2);

    hook.unmount();
  });

  test("resolve calls ipc and refetches pending permissions", async () => {
    const permissions = [makePermission()];
    const mockClient = makeMockClient({
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettingsView({ permissionMode: "requires_approval" })),
      getPendingPermissions: vi
        .fn()
        .mockResolvedValueOnce(permissions)
        .mockResolvedValueOnce([]),
    });
    getIpcClient.mockReturnValue(mockClient);

    const hook = renderUsePendingPermissions({ pollIntervalMs: 0 });

    await waitFor(
      () => hook.result,
      (result) => result.pendingCount === 1,
    );

    await act(async () => {
      await hook.result?.resolveAsync("perm-1", "approve");
    });

    expect(mockClient.resolvePermission).toHaveBeenCalledWith({
      id: "perm-1",
      decision: "approve",
    });
    expect(mockClient.getPendingPermissions).toHaveBeenCalledTimes(2);
    expect(hook.result?.pendingCount).toBe(0);
    expect(hook.result?.resolvingId).toBeNull();

    hook.unmount();
  });
});

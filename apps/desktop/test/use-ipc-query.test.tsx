// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SettingsView, SymphonyDesktopApi } from "@/ipc";
import {
  type IpcQueryFn,
  type UseIpcQueryResult,
  useIpcQuery,
} from "@/renderer/hooks/use-ipc-query";
import { IpcUnavailableError } from "@/renderer/lib/ipc-client";

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

function makeSettingsView(): SettingsView {
  return {
    status: "idle",
    workflowPath: "/tmp/WORKFLOW.md",
    workflowVersion: "1",
    runtimeAdapterKind: "mock-acp",
    pollIntervalMs: 30_000,
    pollIntervalSource: "workflow",
    permissionMode: "auto_approve",
    permissionModeSource: "workflow",
    project: { id: "symphony-local", name: "symphony-local", slug: "symphony-local" },
    acp: {
      mode: "mock",
      command: "node",
      args: [],
      mockCompletionDelayMs: 1200,
    },
    startedAt: null,
    nextTickAt: null,
    tickCount: 0,
    lastTickAt: null,
    lastAction: null,
    lastError: null,
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
  readResult: () => UseIpcQueryResult<unknown>,
  predicate: (result: UseIpcQueryResult<unknown>) => boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await flushMicrotasks();
    if (predicate(readResult())) {
      return;
    }
  }
  throw new Error("timed out waiting for hook state");
}

function renderUseIpcQuery<T>(
  queryKey: string,
  queryFn: IpcQueryFn<T>,
  options?: Parameters<typeof useIpcQuery<T>>[2],
) {
  const state: { current: UseIpcQueryResult<T> | null } = { current: null };
  const container = document.createElement("div");
  let root: Root | null = createRoot(container);

  function HookHost() {
    state.current = useIpcQuery(queryKey, queryFn, options);
    return null;
  }

  act(() => {
    root?.render(createElement(HookHost));
  });

  return {
    get result(): UseIpcQueryResult<T> {
      if (!state.current) {
        throw new Error("hook not mounted");
      }
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

describe("useIpcQuery", () => {
  beforeEach(() => {
    getIpcClient.mockReset();
    isIpcAvailable.mockReset();
    isIpcAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("passes getIpcClient to queryFn and loads desktop api getter result", async () => {
    const settings = makeSettingsView();
    const mockClient = makeMockClient({
      getSettings: vi.fn().mockResolvedValue(settings),
    });
    getIpcClient.mockReturnValue(mockClient);

    const queryFn = vi.fn((client: SymphonyDesktopApi) => client.getSettings());
    const hook = renderUseIpcQuery("settings", queryFn);

    await waitFor(
      () => hook.result,
      (result) => !result.isLoading && result.data != null,
    );

    expect(getIpcClient).toHaveBeenCalledTimes(1);
    expect(queryFn).toHaveBeenCalledWith(mockClient);
    expect(mockClient.getSettings).toHaveBeenCalledTimes(1);
    expect(hook.result.data).toEqual(settings);
    expect(hook.result.error).toBeNull();
    expect(hook.result.isRefreshing).toBe(false);

    hook.unmount();
  });

  test("surfaces ipc unavailable errors", async () => {
    isIpcAvailable.mockReturnValue(false);

    const hook = renderUseIpcQuery("settings", (client) => client.getSettings());

    await waitFor(
      () => hook.result,
      (result) => !result.isLoading && result.error != null,
    );

    expect(hook.result.error).toBeInstanceOf(IpcUnavailableError);
    expect(hook.result.data).toBeUndefined();
    expect(getIpcClient).not.toHaveBeenCalled();

    hook.unmount();
  });

  test("surfaces query function failures", async () => {
    getIpcClient.mockReturnValue(makeMockClient());

    const hook = renderUseIpcQuery("settings", async () => {
      throw new Error("query failed");
    });

    await waitFor(
      () => hook.result,
      (result) => !result.isLoading && result.error != null,
    );

    expect(hook.result.error?.message).toBe("query failed");
    expect(hook.result.data).toBeUndefined();

    hook.unmount();
  });

  test("skips fetch when disabled", async () => {
    getIpcClient.mockReturnValue(makeMockClient());

    const hook = renderUseIpcQuery("settings", (client) => client.getSettings(), {
      enabled: false,
    });

    await flushMicrotasks();

    expect(hook.result.isLoading).toBe(false);
    expect(hook.result.data).toBeUndefined();
    expect(getIpcClient).not.toHaveBeenCalled();

    hook.unmount();
  });

  test("refetch uses isRefreshing after initial load", async () => {
    const settings = makeSettingsView();
    const mockClient = makeMockClient({
      getSettings: vi.fn().mockResolvedValue(settings),
    });
    getIpcClient.mockReturnValue(mockClient);

    const hook = renderUseIpcQuery("settings", (client) => client.getSettings());

    await waitFor(
      () => hook.result,
      (result) => !result.isLoading && result.data != null,
    );

    let resolveRefetch!: (value: SettingsView) => void;
    vi.mocked(mockClient.getSettings).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefetch = resolve;
        }),
    );

    let refetchPromise: Promise<void> | undefined;
    await act(async () => {
      refetchPromise = hook.result.refetch();
      await flushMicrotasks();
    });

    expect(hook.result.isRefreshing).toBe(true);
    expect(hook.result.isLoading).toBe(false);

    await act(async () => {
      resolveRefetch(settings);
      await refetchPromise;
      await flushMicrotasks();
    });

    expect(mockClient.getSettings).toHaveBeenCalledTimes(2);
    expect(hook.result.isRefreshing).toBe(false);
    expect(hook.result.data).toEqual(settings);

    hook.unmount();
  });

  test("polls on interval when pollIntervalMs is set", async () => {
    vi.useFakeTimers();

    const settings = makeSettingsView();
    const mockClient = makeMockClient({
      getSettings: vi.fn().mockResolvedValue(settings),
    });
    getIpcClient.mockReturnValue(mockClient);

    const hook = renderUseIpcQuery("settings", (client) => client.getSettings(), {
      pollIntervalMs: 1000,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockClient.getSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockClient.getSettings).toHaveBeenCalledTimes(2);

    hook.unmount();
  });
});

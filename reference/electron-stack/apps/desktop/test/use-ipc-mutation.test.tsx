// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ControlRuntimeRequest, RuntimeStateSnapshot, SymphonyDesktopApi } from "@/ipc";
import {
  type IpcMutationFn,
  type UseIpcMutationResult,
  useIpcMutation,
} from "@/renderer/hooks/use-ipc-mutation";
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

function makeRuntimeSnapshot(): RuntimeStateSnapshot {
  return {
    generatedAt: "2026-05-26T00:00:00.000Z",
    status: "running",
    workflowPath: "/tmp/WORKFLOW.md",
    workflowVersion: "1",
    workflowLastReloadedAt: "2026-05-26T00:00:00.000Z",
    startedAt: "2026-05-26T00:00:00.000Z",
    pollIntervalMs: 30_000,
    pollIntervalSource: "workflow",
    nextTickAt: null,
    tickCount: 1,
    lastTickAt: null,
    lastDispatchedCount: 0,
    lastDeferredCount: 0,
    lastCancelledCount: 0,
    lastAction: "runtime_started",
    lastError: null,
    validationError: null,
    counts: { running: 0, retrying: 0, candidates: 0 },
    agentTotals: { activeSessions: 0 },
    running: [],
    retrying: [],
    recentFinished: [],
    candidates: [],
    recentEvents: [],
  };
}

function makeMockClient(overrides: Partial<SymphonyDesktopApi> = {}): SymphonyDesktopApi {
  return {
    getRuntimeState: vi.fn(),
    getProjectBoard: vi.fn(),
    getIssue: vi.fn(),
    mutateIssue: vi.fn(),
    controlRuntime: vi.fn().mockResolvedValue(makeRuntimeSnapshot()),
    getSettings: vi.fn(),
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

function renderUseIpcMutation<TInput, TResult>(
  mutationFn: IpcMutationFn<TInput, TResult>,
) {
  const state: { current: UseIpcMutationResult<TInput, TResult> | null } = { current: null };
  const container = document.createElement("div");
  let root: Root | null = createRoot(container);

  function HookHost() {
    state.current = useIpcMutation(mutationFn);
    return null;
  }

  act(() => {
    root?.render(createElement(HookHost));
  });

  return {
    get result(): UseIpcMutationResult<TInput, TResult> {
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

describe("useIpcMutation", () => {
  const startRequest: ControlRuntimeRequest = { action: "start" };

  beforeEach(() => {
    getIpcClient.mockReset();
    isIpcAvailable.mockReset();
    isIpcAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("passes getIpcClient and input to mutationFn and calls desktop api command", async () => {
    const snapshot = makeRuntimeSnapshot();
    const mockClient = makeMockClient({
      controlRuntime: vi.fn().mockResolvedValue(snapshot),
    });
    getIpcClient.mockReturnValue(mockClient);

    const mutationFn = vi.fn((client: SymphonyDesktopApi, input: ControlRuntimeRequest) =>
      client.controlRuntime(input),
    );
    const hook = renderUseIpcMutation(mutationFn);

    let result: RuntimeStateSnapshot | undefined;
    await act(async () => {
      result = await hook.result.mutateAsync(startRequest);
      await flushMicrotasks();
    });

    expect(getIpcClient).toHaveBeenCalledTimes(1);
    expect(mutationFn).toHaveBeenCalledWith(mockClient, startRequest);
    expect(mockClient.controlRuntime).toHaveBeenCalledWith(startRequest);
    expect(result).toEqual(snapshot);
    expect(hook.result.error).toBeNull();
    expect(hook.result.isPending).toBe(false);

    hook.unmount();
  });

  test("tracks isPending while mutation is in flight", async () => {
    const snapshot = makeRuntimeSnapshot();
    const mockClient = makeMockClient();
    getIpcClient.mockReturnValue(mockClient);

    let resolveControl!: (value: RuntimeStateSnapshot) => void;
    vi.mocked(mockClient.controlRuntime).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveControl = resolve;
        }),
    );

    const hook = renderUseIpcMutation<ControlRuntimeRequest, RuntimeStateSnapshot>(
      (client, input) => client.controlRuntime(input),
    );

    let mutationPromise: Promise<RuntimeStateSnapshot> | undefined;
    await act(async () => {
      mutationPromise = hook.result.mutateAsync(startRequest);
      await flushMicrotasks();
    });

    expect(hook.result.isPending).toBe(true);
    expect(hook.result.error).toBeNull();

    await act(async () => {
      resolveControl(snapshot);
      await mutationPromise;
      await flushMicrotasks();
    });

    expect(hook.result.isPending).toBe(false);

    hook.unmount();
  });

  test("surfaces ipc unavailable errors", async () => {
    isIpcAvailable.mockReturnValue(false);

    const hook = renderUseIpcMutation<ControlRuntimeRequest, RuntimeStateSnapshot>(
      (client, input) => client.controlRuntime(input),
    );

    await act(async () => {
      await expect(hook.result.mutateAsync(startRequest)).rejects.toBeInstanceOf(
        IpcUnavailableError,
      );
      await flushMicrotasks();
    });

    expect(hook.result.error).toBeInstanceOf(IpcUnavailableError);
    expect(hook.result.isPending).toBe(false);
    expect(getIpcClient).not.toHaveBeenCalled();

    hook.unmount();
  });

  test("surfaces mutation failures from mutateAsync", async () => {
    getIpcClient.mockReturnValue(makeMockClient());

    const hook = renderUseIpcMutation<ControlRuntimeRequest, RuntimeStateSnapshot>(
      async () => {
        throw new Error("mutation failed");
      },
    );

    await act(async () => {
      await expect(hook.result.mutateAsync(startRequest)).rejects.toThrow("mutation failed");
      await flushMicrotasks();
    });

    expect(hook.result.error?.message).toBe("mutation failed");
    expect(hook.result.isPending).toBe(false);

    hook.unmount();
  });

  test("mutate stores errors without throwing to the caller", async () => {
    getIpcClient.mockReturnValue(makeMockClient());

    const hook = renderUseIpcMutation<ControlRuntimeRequest, RuntimeStateSnapshot>(
      async () => {
        throw new Error("mutation failed");
      },
    );

    await act(async () => {
      hook.result.mutate(startRequest);
      await flushMicrotasks();
    });

    expect(hook.result.error?.message).toBe("mutation failed");
    expect(hook.result.isPending).toBe(false);

    hook.unmount();
  });

  test("reset clears error and pending state", async () => {
    getIpcClient.mockReturnValue(makeMockClient());

    const hook = renderUseIpcMutation<ControlRuntimeRequest, RuntimeStateSnapshot>(
      async () => {
        throw new Error("mutation failed");
      },
    );

    await act(async () => {
      await expect(hook.result.mutateAsync(startRequest)).rejects.toThrow("mutation failed");
      await flushMicrotasks();
    });

    expect(hook.result.error).not.toBeNull();

    act(() => {
      hook.result.reset();
    });

    expect(hook.result.error).toBeNull();
    expect(hook.result.isPending).toBe(false);

    hook.unmount();
  });
});

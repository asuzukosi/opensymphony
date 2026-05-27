// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "@/renderer/layout/app-shell";
import type { PendingPermission } from "@/ipc";
import type { UsePendingPermissionsResult } from "@/renderer/hooks/use-pending-permissions";

const usePendingPermissionsMock = vi.fn<() => UsePendingPermissionsResult>();

vi.mock("@/renderer/hooks/use-pending-permissions", () => ({
  usePendingPermissions: () => usePendingPermissionsMock(),
}));

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

function makePendingPermissionsResult(
  overrides: Partial<UsePendingPermissionsResult> = {},
): UsePendingPermissionsResult {
  return {
    permissions: [],
    pendingCount: 0,
    isApprovalRequired: false,
    error: null,
    isLoading: false,
    isRefreshing: false,
    refetch: vi.fn(async () => undefined),
    resolve: vi.fn(),
    resolveAsync: vi.fn(async () => undefined),
    isResolving: false,
    resolvingId: null,
    resolveError: null,
    resetResolveError: vi.fn(),
    ...overrides,
  };
}

describe("AppShell permission queue", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    usePendingPermissionsMock.mockReset();
    usePendingPermissionsMock.mockReturnValue(makePendingPermissionsResult());
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderShell(): Promise<void> {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/"] },
          createElement(
            Routes,
            null,
            createElement(
              Route,
              { element: createElement(AppShell) },
              createElement(Route, { index: true, element: createElement("div", null, "page content") }),
            ),
          ),
        ),
      );
    });
  }

  test("does not render permission queue in auto_approve mode", async () => {
    await renderShell();

    expect(container.textContent).toContain("page content");
    expect(container.textContent).not.toContain("Pending agent permissions");
  });

  test("does not render permission queue when approval is required but queue is empty", async () => {
    usePendingPermissionsMock.mockReturnValue(
      makePendingPermissionsResult({
        isApprovalRequired: true,
        pendingCount: 0,
      }),
    );

    await renderShell();

    expect(container.textContent).not.toContain("Pending agent permissions");
  });

  test("renders permission queue when approval is required and permissions are pending", async () => {
    usePendingPermissionsMock.mockReturnValue(
      makePendingPermissionsResult({
        isApprovalRequired: true,
        pendingCount: 1,
        permissions: [makePermission()],
      }),
    );

    await renderShell();

    expect(container.textContent).toContain("Pending agent permissions (1)");
    expect(container.textContent).toContain("Run tests");
    expect(container.textContent).toContain("page content");
  });
});

// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ACPPermissionQueue } from "@/renderer/components/acp-permission-queue";
import type { PendingPermission } from "@/ipc";

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

describe("ACP permission queue", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function renderQueue(
    permissions: PendingPermission[],
    onResolve = vi.fn(async () => undefined),
  ): Promise<ReturnType<typeof vi.fn>> {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(ACPPermissionQueue, {
            permissions,
            onResolve,
          }),
        ),
      );
    });
    return onResolve;
  }

  test("renders nothing when there are no pending permissions", async () => {
    await renderQueue([]);
    expect(container.textContent).toBe("");
  });

  test("lists pending permissions with issue and session context", async () => {
    await renderQueue([makePermission()]);

    expect(container.textContent).toContain("Pending agent permissions (1)");
    expect(container.textContent).toContain("Run tests");
    expect(container.textContent).toContain("issue-1");
    expect(container.textContent).toContain("session-");
  });

  test("calls onResolve with approve or deny", async () => {
    const onResolve = await renderQueue([makePermission()]);

    const approveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Approve"),
    );
    const denyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Deny"),
    );

    await act(async () => {
      approveButton?.click();
    });
    expect(onResolve).toHaveBeenCalledWith("perm-1", "approve");

    await act(async () => {
      denyButton?.click();
    });
    expect(onResolve).toHaveBeenCalledWith("perm-1", "deny");
  });
});

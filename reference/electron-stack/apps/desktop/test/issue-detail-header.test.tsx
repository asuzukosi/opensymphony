// @vitest-environment happy-dom

import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IssueDetailHeader } from "@/renderer/components/issue-detail-header";
import type { IssueDetail } from "@/ipc";

function makeIssue(overrides: Partial<IssueDetail> = {}): IssueDetail {
  return {
    issueId: "issue-1",
    projectId: "symphony-local",
    identifier: "SYM-1",
    title: "Test issue",
    description: "Details",
    priority: null,
    workflowStateId: "symphony-local:human_review",
    workflowStateName: "Human Review",
    comments: [],
    attempts: [],
    ...overrides,
  };
}

describe("IssueDetailHeader", () => {
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

  async function renderHeader(props: Partial<ComponentProps<typeof IssueDetailHeader>> = {}) {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(IssueDetailHeader, {
            issue: makeIssue(),
            workflowStates: [
              { stateId: "symphony-local:human_review", stateName: "Human Review" },
              { stateId: "symphony-local:done", stateName: "Done" },
            ],
            onStateChange: vi.fn(async () => {}),
            onApprove: vi.fn(async () => {}),
            ...props,
          }),
        ),
      );
    });
  }

  test("shows approve button when issue is in human review", async () => {
    await renderHeader();

    expect(container.textContent).toContain("Approve");
  });

  test("hides approve button when issue is already done", async () => {
    await renderHeader({
      issue: makeIssue({
        workflowStateId: "symphony-local:done",
        workflowStateName: "Done",
      }),
    });

    expect(container.textContent).not.toContain("Approve");
  });
});

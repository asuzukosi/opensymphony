import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { closeDatabase, createTrackerStore, openDatabase } from "@symphony/db";
import { demoAcpWorkflowBlock } from "./fixtures/demo-acp-workflow";

const tempDirs: string[] = [];
let userDataDir = "";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === "userData") {
        return userDataDir;
      }
      return "/tmp/electron-mock";
    }),
  },
}));

describe("getProjectBoard", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-get-project-board-"));
    tempDirs.push(userDataDir);
  });

  afterEach(async () => {
    vi.resetModules();
    if (originalWorkflowPath === undefined) {
      delete process.env.SYMPHONY_WORKFLOW_PATH;
    } else {
      process.env.SYMPHONY_WORKFLOW_PATH = originalWorkflowPath;
    }
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  test("returns workflow columns from listIssuesGroupedByWorkflowState", async () => {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-board-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
${demoAcpWorkflowBlock()}
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const { getProjectBoard, stopOrchestratorRuntime } = await import("../src/orchestrator-runtime");
    getProjectBoard();

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    store.issues.createIssue({
      id: "i1",
      projectId: "symphony-local",
      workflowStateId: "symphony-local:todo",
      identifier: "SYM-1",
      title: "Todo issue",
      description: null,
      priority: 2,
    });
    store.issues.createIssue({
      id: "i2",
      projectId: "symphony-local",
      workflowStateId: "symphony-local:in_progress",
      identifier: "SYM-2",
      title: "Active issue",
      description: null,
      priority: 1,
    });
    closeDatabase(db);

    const board = getProjectBoard();

    expect(board.columns.map((column) => column.stateId)).toEqual([
      "symphony-local:todo",
      "symphony-local:in_progress",
      "symphony-local:human_review",
      "symphony-local:done",
    ]);
    expect(board.columns[0]).toMatchObject({
      stateName: "Todo",
      issues: [
        {
          issueId: "i1",
          identifier: "SYM-1",
          title: "Todo issue",
          priority: 2,
        },
      ],
    });
    expect(board.columns[1]).toMatchObject({
      stateName: "In Progress",
      issues: [
        {
          issueId: "i2",
          identifier: "SYM-2",
          title: "Active issue",
          priority: 1,
        },
      ],
    });
    expect(board.columns[2]?.issues).toEqual([]);
    expect(board.columns[3]?.issues).toEqual([]);

    stopOrchestratorRuntime();
  });
});

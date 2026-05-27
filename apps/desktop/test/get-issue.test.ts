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

describe("getIssue", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-get-issue-"));
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

  test("returns issue detail assembled by getIssueDetail", async () => {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-issue-"));
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

    const { getIssue, getProjectBoard, stopOrchestratorRuntime } = await import(
      "../src/orchestrator-runtime"
    );
    getProjectBoard();

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    store.issues.createIssue({
      id: "i1",
      projectId: "symphony-local",
      workflowStateId: "symphony-local:in_progress",
      identifier: "SYM-1",
      title: "Detail issue",
      description: "details here",
      priority: 2,
    });
    store.comments.addComment({
      id: "c1",
      issueId: "i1",
      body: "first comment",
      authorId: "user-1",
    });
    store.runAttempts.createRunAttempt({
      id: "run-1",
      issueId: "i1",
      attemptNumber: 1,
      status: "running",
    });
    store.agentSessions.createSession({
      id: "sess-1",
      runAttemptId: "run-1",
      sessionRef: "11111111-1111-4111-8111-111111111111",
      status: "running",
    });
    store.sessionEvents.append({
      id: "event-1",
      sessionId: "sess-1",
      kind: "prompt",
      payload: { text: "run task" },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    closeDatabase(db);

    const detail = getIssue("i1");

    expect(detail).toMatchObject({
      issueId: "i1",
      projectId: "symphony-local",
      identifier: "SYM-1",
      title: "Detail issue",
      description: "details here",
      priority: 2,
      workflowStateId: "symphony-local:in_progress",
      workflowStateName: "In Progress",
    });
    expect(detail.comments).toEqual([
      {
        id: "c1",
        body: "first comment",
        authorId: "user-1",
        createdAt: expect.any(String),
      },
    ]);
    expect(detail.attempts).toHaveLength(1);
    expect(detail.attempts[0]).toMatchObject({
      runAttemptId: "run-1",
      attemptNumber: 1,
      status: "running",
      sessions: [
        {
          sessionId: "sess-1",
          sessionRef: "11111111-1111-4111-8111-111111111111",
          status: "running",
          startedAt: expect.any(String),
          finishedAt: null,
          events: [
            {
              id: "event-1",
              kind: "prompt",
              payload: { text: "run task" },
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      ],
    });

    stopOrchestratorRuntime();
  });

  test("throws when issue is missing", async () => {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-issue-missing-"));
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

    const { getIssue, getProjectBoard, stopOrchestratorRuntime } = await import(
      "../src/orchestrator-runtime"
    );
    getProjectBoard();

    expect(() => getIssue("missing")).toThrow("issue not found: missing");

    stopOrchestratorRuntime();
  });
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { closeDatabase, createTrackerStore, openDatabase } from "@symphony/db";

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

describe("mutateIssue create", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-mutate-issue-"));
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

  test("creates issue via tracker service with generated identifier", async () => {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-mutate-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
acp:
  mode: mock
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const { mutateIssue, getProjectBoard, stopOrchestratorRuntime } = await import(
      "../src/orchestrator-runtime"
    );
    getProjectBoard();

    mutateIssue({
      action: "create",
      projectId: "symphony-local",
      title: "New task",
      description: "do the thing",
      priority: 1,
    });

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const issues = store.issues.listIssuesByStateCategories("symphony-local", [
      "active",
      "backlog",
      "terminal",
      "other",
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      projectId: "symphony-local",
      identifier: "SYMPHONYLOCAL-1",
      title: "New task",
      description: "do the thing",
      priority: 1,
      workflowStateId: "symphony-local:todo",
    });

    closeDatabase(db);
    stopOrchestratorRuntime();
  });

  test("transitions created issue when workflowStateId is provided", async () => {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-mutate-state-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
acp:
  mode: mock
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const { mutateIssue, getProjectBoard, stopOrchestratorRuntime } = await import(
      "../src/orchestrator-runtime"
    );
    getProjectBoard();

    mutateIssue({
      action: "create",
      projectId: "symphony-local",
      title: "Active task",
      workflowStateId: "symphony-local:in_progress",
    });

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const issue = store.issues.listIssuesByStateCategories("symphony-local", [
      "active",
      "backlog",
      "terminal",
      "other",
    ])[0];

    expect(issue?.workflowStateId).toBe("symphony-local:in_progress");

    closeDatabase(db);
    stopOrchestratorRuntime();
  });

  test("rejects create for mismatched project id", async () => {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-mutate-reject-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
acp:
  mode: mock
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const { mutateIssue, getProjectBoard, stopOrchestratorRuntime } = await import(
      "../src/orchestrator-runtime"
    );
    getProjectBoard();

    expect(() =>
      mutateIssue({
        action: "create",
        projectId: "other-project",
        title: "Rejected task",
      }),
    ).toThrow("project mismatch: other-project");

    stopOrchestratorRuntime();
  });
});

describe("mutateIssue update", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-mutate-issue-update-"));
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

  async function seedIssue() {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-mutate-update-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
acp:
  mode: mock
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const { mutateIssue, getProjectBoard, stopOrchestratorRuntime } = await import(
      "../src/orchestrator-runtime"
    );
    getProjectBoard();

    mutateIssue({
      action: "create",
      projectId: "symphony-local",
      title: "Original title",
      description: "original description",
      priority: 3,
    });

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const issue = store.issues.listIssuesByStateCategories("symphony-local", [
      "active",
      "backlog",
      "terminal",
      "other",
    ])[0];
    closeDatabase(db);

    return { mutateIssue, stopOrchestratorRuntime, issueId: issue!.id };
  }

  test("updates title, description, and priority via tracker service", async () => {
    const { mutateIssue, stopOrchestratorRuntime, issueId } = await seedIssue();

    mutateIssue({
      action: "update",
      issueId,
      title: "Updated title",
      description: "updated description",
      priority: 1,
    });

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const issue = store.issues.getIssueById(issueId);

    expect(issue).toMatchObject({
      title: "Updated title",
      description: "updated description",
      priority: 1,
    });

    closeDatabase(db);
    stopOrchestratorRuntime();
  });

  test("rejects empty title updates", async () => {
    const { mutateIssue, stopOrchestratorRuntime, issueId } = await seedIssue();

    expect(() =>
      mutateIssue({
        action: "update",
        issueId,
        title: "   ",
      }),
    ).toThrow("title is required");

    stopOrchestratorRuntime();
  });
});

describe("mutateIssue transition", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-mutate-issue-transition-"));
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

  async function seedIssue() {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-mutate-transition-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
acp:
  mode: mock
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const { mutateIssue, getProjectBoard, stopOrchestratorRuntime } = await import(
      "../src/orchestrator-runtime"
    );
    getProjectBoard();

    mutateIssue({
      action: "create",
      projectId: "symphony-local",
      title: "Transition me",
    });

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const issue = store.issues.listIssuesByStateCategories("symphony-local", [
      "active",
      "backlog",
      "terminal",
      "other",
    ])[0];
    closeDatabase(db);

    return { mutateIssue, stopOrchestratorRuntime, issueId: issue!.id };
  }

  test("transitions issue via issue service", async () => {
    const { mutateIssue, stopOrchestratorRuntime, issueId } = await seedIssue();

    mutateIssue({
      action: "transition",
      issueId,
      targetStateId: "symphony-local:in_progress",
      actor: "operator",
    });

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const issue = store.issues.getIssueById(issueId);
    const audit = store.audits.listAuditEvents("symphony-local");

    expect(issue?.workflowStateId).toBe("symphony-local:in_progress");
    expect(audit.map((event) => event.action)).toContain("issue.transitioned");

    closeDatabase(db);
    stopOrchestratorRuntime();
  });

  test("rejects invalid terminal to non-terminal transition", async () => {
    const { mutateIssue, stopOrchestratorRuntime, issueId } = await seedIssue();

    mutateIssue({
      action: "transition",
      issueId,
      targetStateId: "symphony-local:done",
    });

    expect(() =>
      mutateIssue({
        action: "transition",
        issueId,
        targetStateId: "symphony-local:todo",
      }),
    ).toThrow("Invalid transition: terminal issues cannot move to non-terminal states");

    stopOrchestratorRuntime();
  });
});

describe("mutateIssue comment", () => {
  const originalWorkflowPath = process.env.SYMPHONY_WORKFLOW_PATH;

  beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), "symphony-mutate-issue-comment-"));
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

  async function seedIssue() {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-mutate-comment-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
acp:
  mode: mock
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const { mutateIssue, getProjectBoard, stopOrchestratorRuntime } = await import(
      "../src/orchestrator-runtime"
    );
    getProjectBoard();

    mutateIssue({
      action: "create",
      projectId: "symphony-local",
      title: "Comment me",
    });

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const issue = store.issues.listIssuesByStateCategories("symphony-local", [
      "active",
      "backlog",
      "terminal",
      "other",
    ])[0];
    closeDatabase(db);

    return { mutateIssue, stopOrchestratorRuntime, issueId: issue!.id };
  }

  test("adds comment via comment service", async () => {
    const { mutateIssue, stopOrchestratorRuntime, issueId } = await seedIssue();

    mutateIssue({
      action: "comment",
      issueId,
      body: "ship it",
      authorId: "operator",
    });

    const db = openDatabase(path.join(userDataDir, "symphony.sqlite"));
    const store = createTrackerStore(db);
    const comments = store.comments.listComments(issueId);
    const audit = store.audits.listAuditEvents("symphony-local");

    expect(comments).toEqual([
      {
        id: expect.any(String),
        issueId,
        body: "ship it",
        authorId: "operator",
      },
    ]);
    expect(audit.map((event) => event.action)).toContain("issue.comment.added");

    closeDatabase(db);
    stopOrchestratorRuntime();
  });

  test("rejects comment on missing issue", async () => {
    const workflowDir = mkdtempSync(path.join(tmpdir(), "symphony-workflow-mutate-comment-missing-"));
    tempDirs.push(workflowDir);
    const workflowPath = path.join(workflowDir, "WORKFLOW.md");
    writeFileSync(
      workflowPath,
      `---
project_id: symphony-local
acp:
  mode: mock
---

Run the issue.
`,
    );
    process.env.SYMPHONY_WORKFLOW_PATH = workflowPath;

    const { mutateIssue, getProjectBoard, stopOrchestratorRuntime } = await import(
      "../src/orchestrator-runtime"
    );
    getProjectBoard();

    expect(() =>
      mutateIssue({
        action: "comment",
        issueId: "missing",
        body: "hello",
      }),
    ).toThrow("Issue not found: missing");

    stopOrchestratorRuntime();
  });
});

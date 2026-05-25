import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { closeDatabase, migrateUp, openDatabase, seedProjectWithDefaultStates } from "@symphony/db";
import { TrackerService } from "@core/services/tracker-service";

const tempDirs: string[] = [];

function dbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "symphony-core-test-"));
  tempDirs.push(dir);
  return path.join(dir, "core.sqlite");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("TrackerService", () => {
  test("creates issue, transitions states, and writes audit events", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project One", slug: "project-one" });

    const service = TrackerService.fromDatabase(db);
    const issue = service.createIssue({
      id: "i1",
      projectId: "p1",
      identifier: "P1-1",
      title: "Implement feature",
      actor: "dev-user",
    });

    expect(issue.workflowStateId).toBe("p1:todo");

    const moved = service.transitionIssue("i1", "p1:in_progress", "dev-user");
    expect(moved.workflowStateId).toBe("p1:in_progress");

    const audit = service.getAuditEvents("p1");
    expect(audit.map((e: { action: string }) => e.action)).toEqual([
      "issue.transitioned",
      "issue.created",
    ]);

    closeDatabase(db);
  });

  test("rejects terminal to non-terminal transition", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project One", slug: "project-one" });

    const service = TrackerService.fromDatabase(db);
    service.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Done task" });
    service.transitionIssue("i1", "p1:done");

    expect(() => service.transitionIssue("i1", "p1:in_progress")).toThrowError(
      "Invalid transition: terminal issues cannot move to non-terminal states",
    );

    closeDatabase(db);
  });

  test("marks issue blocked until dependency reaches terminal state", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project One", slug: "project-one" });

    const service = TrackerService.fromDatabase(db);
    service.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Primary task" });
    service.createIssue({
      id: "i2",
      projectId: "p1",
      identifier: "P1-2",
      title: "Dependency task",
    });

    service.addDependency("i1", "i2", "planner");

    expect(service.isIssueBlocked("i1")).toBe(true);

    service.transitionIssue("i2", "p1:done", "planner");

    expect(service.isIssueBlocked("i1")).toBe(false);

    const audit = service.getAuditEvents("p1").map((entry: { action: string }) => entry.action);
    expect(audit).toContain("issue.dependency.added");

    closeDatabase(db);
  });

  test("supports comments, labels, and assignment history", () => {
    const db = openDatabase(dbPath());
    migrateUp(db);
    seedProjectWithDefaultStates(db, { id: "p1", name: "Project One", slug: "project-one" });

    const service = TrackerService.fromDatabase(db);
    service.createIssue({ id: "i1", projectId: "p1", identifier: "P1-1", title: "Primary task" });

    service.addComment({
      id: "c1",
      issueId: "i1",
      body: "First note",
      authorId: "u1",
      actor: "u1",
    });
    const comments = service.listComments("i1");
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe("First note");

    service.addLabelToIssue({
      id: "l1",
      projectId: "p1",
      issueId: "i1",
      name: "backend",
      color: "#00AAFF",
      actor: "u1",
    });
    const labels = service.listIssueLabels("i1");
    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe("backend");

    service.assignIssue({ issueId: "i1", assigneeId: "user-a", assignmentId: "a1", actor: "lead" });
    service.assignIssue({ issueId: "i1", assigneeId: "user-b", assignmentId: "a2", actor: "lead" });

    const active = service.getActiveAssignment("i1");
    const history = service.listAssignmentHistory("i1");

    expect(active?.assigneeId).toBe("user-b");
    expect(history).toHaveLength(2);
    expect(history[0].unassignedAt).not.toBeNull();
    expect(history[1].unassignedAt).toBeNull();

    const auditActions = service
      .getAuditEvents("p1")
      .map((entry: { action: string }) => entry.action);
    expect(auditActions).toContain("issue.comment.added");
    expect(auditActions).toContain("issue.label.added");
    expect(auditActions).toContain("issue.assigned");

    closeDatabase(db);
  });
});

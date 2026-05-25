import type { SqliteDatabase } from "@db/client";
import type { IAssignmentRepo } from "@db/types/repo";
import type { AssignmentRow } from "@db/types/domain";

export class AssignmentRepo implements IAssignmentRepo {
  constructor(private readonly db: SqliteDatabase) {}

  closeActiveAssignments(issueId: string): void {
    this.db
      .prepare(
        `UPDATE assignments
         SET unassigned_at = datetime('now')
         WHERE issue_id = ? AND unassigned_at IS NULL`,
      )
      .run(issueId);
  }

  addAssignment(issueId: string, assignmentId: string, assigneeId: string): void {
    this.db
      .prepare(
        `INSERT INTO assignments (id, issue_id, assignee_id)
         VALUES (?, ?, ?)`,
      )
      .run(assignmentId, issueId, assigneeId);
  }

  getActiveAssignment(issueId: string): AssignmentRow | null {
    return (
      (this.db
        .prepare(
          `SELECT id, issue_id as issueId, assignee_id as assigneeId, assigned_at as assignedAt, unassigned_at as unassignedAt
           FROM assignments
           WHERE issue_id = ? AND unassigned_at IS NULL
           ORDER BY assigned_at DESC
           LIMIT 1`,
        )
        .get(issueId) as AssignmentRow | undefined) ?? null
    );
  }

  listAssignmentHistory(issueId: string): AssignmentRow[] {
    return this.db
      .prepare(
        `SELECT id, issue_id as issueId, assignee_id as assigneeId, assigned_at as assignedAt, unassigned_at as unassignedAt
         FROM assignments
         WHERE issue_id = ?
         ORDER BY assigned_at ASC`,
      )
      .all(issueId) as AssignmentRow[];
  }
}

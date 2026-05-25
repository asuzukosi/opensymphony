import type { SqliteDatabase } from "@db/client";
import type { ILabelRepo } from "@db/types/repo";
import type { LabelRow } from "@db/types/domain";

export class LabelRepo implements ILabelRepo {
  constructor(private readonly db: SqliteDatabase) {}

  upsertLabel(input: LabelRow): void {
    this.db
      .prepare(
        `INSERT INTO labels (id, project_id, name, color)
         VALUES (@id, @projectId, @name, @color)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           color = excluded.color`,
      )
      .run(input);
  }

  attachLabel(issueId: string, labelId: string): void {
    this.db
      .prepare(`INSERT OR IGNORE INTO issue_labels (issue_id, label_id) VALUES (?, ?)`)
      .run(issueId, labelId);
  }

  listIssueLabels(issueId: string): LabelRow[] {
    return this.db
      .prepare(
        `SELECT l.id, l.project_id as projectId, l.name, l.color
         FROM issue_labels il
         JOIN labels l ON l.id = il.label_id
         WHERE il.issue_id = ?
         ORDER BY l.name ASC`,
      )
      .all(issueId) as LabelRow[];
  }
}

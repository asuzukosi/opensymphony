import type { SqliteDatabase } from "@db/client";
import type { IProjectRepo } from "@db/types/repo";
import type { ProjectRow } from "@db/types/domain";

export class ProjectRepo implements IProjectRepo {
  constructor(private readonly db: SqliteDatabase) {}

  getProject(projectId: string): ProjectRow | null {
    return (
      (this.db.prepare(`SELECT id, name, slug FROM projects WHERE id = ?`).get(projectId) as
        | ProjectRow
        | undefined) ?? null
    );
  }
}

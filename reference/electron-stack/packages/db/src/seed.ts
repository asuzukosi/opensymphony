import type { SqliteDatabase } from "@db/client";

const DEFAULT_STATES = [
  { id: "todo", name: "Todo", category: "backlog", position: 10, isDefault: 1 },
  { id: "in_progress", name: "In Progress", category: "active", position: 20, isDefault: 0 },
  { id: "human_review", name: "Human Review", category: "active", position: 30, isDefault: 0 },
  { id: "done", name: "Done", category: "terminal", position: 40, isDefault: 0 },
] as const;

export interface SeedProjectInput {
  id: string;
  name: string;
  slug: string;
}

export function seedProjectWithDefaultStates(db: SqliteDatabase, project: SeedProjectInput): void {
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (id, name, slug)
       VALUES (@id, @name, @slug)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         slug = excluded.slug,
         updated_at = datetime('now')`,
    ).run(project);

    const insertState = db.prepare(
      `INSERT INTO workflow_states (id, project_id, name, category, position, is_default)
       VALUES (@id, @projectId, @name, @category, @position, @isDefault)
       ON CONFLICT(id) DO NOTHING`,
    );

    for (const state of DEFAULT_STATES) {
      insertState.run({
        ...state,
        id: `${project.id}:${state.id}`,
        projectId: project.id,
      });
    }
  });

  tx();
}

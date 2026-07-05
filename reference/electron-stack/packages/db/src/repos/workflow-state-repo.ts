import type { SqliteDatabase } from "@db/client";
import type { IWorkflowStateRepo } from "@db/types/repo";
import type { WorkflowStateRow } from "@db/types/domain";

export class WorkflowStateRepo implements IWorkflowStateRepo {
  constructor(private readonly db: SqliteDatabase) {}

  listWorkflowStates(projectId: string): WorkflowStateRow[] {
    return this.db
      .prepare(
        `SELECT id, project_id as projectId, name, category, position
         FROM workflow_states WHERE project_id = ? ORDER BY position ASC`,
      )
      .all(projectId) as WorkflowStateRow[];
  }

  getWorkflowStateById(stateId: string): WorkflowStateRow | null {
    return (
      (this.db
        .prepare(
          `SELECT id, project_id as projectId, name, category, position FROM workflow_states WHERE id = ?`,
        )
        .get(stateId) as WorkflowStateRow | undefined) ?? null
    );
  }

  findDefaultWorkflowState(projectId: string): WorkflowStateRow | null {
    return (
      (this.db
        .prepare(
          `SELECT id, project_id as projectId, name, category, position
           FROM workflow_states
           WHERE project_id = ? AND is_default = 1
           ORDER BY position ASC
           LIMIT 1`,
        )
        .get(projectId) as WorkflowStateRow | undefined) ?? null
    );
  }
}

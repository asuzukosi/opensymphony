import type { SqliteDatabase } from "@db/client";
import type { IDependencyRepo } from "@db/types/repo";
import type { WorkflowStateCategory } from "@db/types/domain";

export class DependencyRepo implements IDependencyRepo {
  constructor(private readonly db: SqliteDatabase) {}

  addDependency(issueId: string, dependsOnIssueId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO issue_dependencies (issue_id, depends_on_issue_id) VALUES (?, ?)`,
      )
      .run(issueId, dependsOnIssueId);
  }

  listDependenciesWithState(
    issueId: string,
  ): Array<{ dependsOnIssueId: string; dependencyCategory: WorkflowStateCategory }> {
    return this.db
      .prepare(
        `SELECT d.depends_on_issue_id as dependsOnIssueId, s.category as dependencyCategory
         FROM issue_dependencies d
         JOIN issues i ON i.id = d.depends_on_issue_id
         JOIN workflow_states s ON s.id = i.workflow_state_id
         WHERE d.issue_id = ?`,
      )
      .all(issueId) as Array<{
      dependsOnIssueId: string;
      dependencyCategory: WorkflowStateCategory;
    }>;
  }
}

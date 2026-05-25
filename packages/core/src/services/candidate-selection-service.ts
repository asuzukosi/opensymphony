import type { IDependencyRepo, IIssueRepo } from "@symphony/db";
import type { CandidateSelectionInput } from "@core/types/orchestrator";

export class CandidateSelectionService {
  constructor(
    private readonly issues: IIssueRepo,
    private readonly dependencies: IDependencyRepo,
  ) {}

  select(
    input: CandidateSelectionInput,
  ): Array<{ issueId: string; identifier: string; priority: number | null }> {
    const candidates = this.issues.listIssuesByStateCategories(input.projectId, [
      "active",
      "backlog",
    ]);
    const unblocked = candidates.filter((issue) => {
      const deps = this.dependencies.listDependenciesWithState(issue.id);
      return !deps.some((dep) => dep.dependencyCategory !== "terminal");
    });

    return unblocked
      .slice(0, Math.max(0, input.maxCount))
      .map((issue) => ({
        issueId: issue.id,
        identifier: issue.identifier,
        priority: issue.priority,
      }));
  }
}

import type { IDependencyRepo, IIssueRepo, IWorkflowStateRepo, IssueRow } from "@symphony/db";
import type { CandidateIssueSnapshot, CandidateSelectionInput } from "@core/types/orchestrator";
import { DEFAULT_ACTIVE_STATE_CATEGORIES } from "@core/types/workflow";

export class CandidateSelectionService {
  constructor(
    private readonly issues: IIssueRepo,
    private readonly dependencies: IDependencyRepo,
    private readonly workflowStates: IWorkflowStateRepo,
  ) {}

  listEligible(projectId: string): CandidateIssueSnapshot[] {
    const candidates = this.issues.listIssuesByStateCategories(projectId, [
      ...DEFAULT_ACTIVE_STATE_CATEGORIES,
    ]);

    return this.filterUnblocked(candidates).map((issue) => {
      const state = this.workflowStates.getWorkflowStateById(issue.workflowStateId);
      return {
        issueId: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        priority: issue.priority,
        stateCategory: state?.category ?? "other",
      };
    });
  }

  select(
    input: CandidateSelectionInput,
  ): Array<{ issueId: string; identifier: string; priority: number | null }> {
    return this.listEligible(input.projectId)
      .slice(0, Math.max(0, input.maxCount))
      .map(({ issueId, identifier, priority }) => ({ issueId, identifier, priority }));
  }

  private filterUnblocked(issues: IssueRow[]): IssueRow[] {
    return issues.filter((issue) => {
      const deps = this.dependencies.listDependenciesWithState(issue.id);
      return !deps.some((dep) => dep.dependencyCategory !== "terminal");
    });
  }
}

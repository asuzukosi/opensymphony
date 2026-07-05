import type { IDependencyRepo, IIssueRepo } from "@symphony/db";
import type { AddDependencyInput } from "@core/types/tracker";
import { AuditService } from "@core/services/audit-service";

export class DependencyService {
  constructor(
    private readonly issues: IIssueRepo,
    private readonly dependencies: IDependencyRepo,
    private readonly audit: AuditService,
  ) {}

  add(input: AddDependencyInput): void {
    const issue = this.requireIssue(input.issueId);
    const dependsOn = this.requireIssue(input.dependsOnIssueId);

    if (issue.projectId !== dependsOn.projectId) {
      throw new Error("Dependencies must belong to the same project");
    }

    this.dependencies.addDependency(input.issueId, input.dependsOnIssueId);
    this.audit.write({
      id: `audit:${input.issueId}:dependency:${input.dependsOnIssueId}`,
      projectId: issue.projectId,
      issueId: input.issueId,
      actor: input.actor,
      action: "issue.dependency.added",
      payload: { dependsOnIssueId: input.dependsOnIssueId },
    });
  }

  isBlocked(issueId: string): boolean {
    this.requireIssue(issueId);
    const deps = this.dependencies.listDependenciesWithState(issueId);
    return deps.some(
      (dep: { dependencyCategory: string }) => dep.dependencyCategory !== "terminal",
    );
  }

  private requireIssue(issueId: string) {
    const issue = this.issues.getIssueById(issueId);
    if (!issue) throw new Error(`Issue not found: ${issueId}`);
    return issue;
  }
}

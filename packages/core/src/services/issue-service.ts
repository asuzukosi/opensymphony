import type {
  IProjectRepo,
  IIssueRepo,
  IWorkflowStateRepo,
  IssueRow,
  WorkflowStateCategory,
} from "@symphony/db";
import type { CreateIssueInput, TransitionIssueInput } from "@core/types/tracker";
import { AuditService } from "@core/services/audit-service";

export class IssueService {
  constructor(
    private readonly projects: IProjectRepo,
    private readonly issues: IIssueRepo,
    private readonly workflowStates: IWorkflowStateRepo,
    private readonly audit: AuditService,
  ) {}

  create(input: CreateIssueInput): IssueRow {
    const project = this.projects.getProject(input.projectId);
    if (!project) throw new Error(`Project not found: ${input.projectId}`);

    const defaultState = this.workflowStates.findDefaultWorkflowState(input.projectId);
    if (!defaultState) throw new Error(`No default workflow state for project: ${input.projectId}`);

    this.issues.createIssue({
      id: input.id,
      projectId: input.projectId,
      workflowStateId: defaultState.id,
      identifier: input.identifier,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? null,
    });

    this.audit.write({
      id: `audit:${input.id}:create`,
      projectId: input.projectId,
      issueId: input.id,
      actor: input.actor,
      action: "issue.created",
      payload: { identifier: input.identifier, stateId: defaultState.id },
    });

    return this.requireIssue(input.id);
  }

  transition(input: TransitionIssueInput): IssueRow {
    const issue = this.requireIssue(input.issueId);
    const currentState = this.requireState(issue.workflowStateId);
    const targetState = this.requireState(input.targetStateId);

    if (issue.projectId !== targetState.projectId) {
      throw new Error("Target workflow state belongs to a different project");
    }

    if (issue.workflowStateId === input.targetStateId) {
      return issue;
    }

    if (currentState.category === "terminal" && targetState.category !== "terminal") {
      throw new Error("Invalid transition: terminal issues cannot move to non-terminal states");
    }

    this.issues.updateIssueState(input.issueId, input.targetStateId);
    this.audit.write({
      id: `audit:${input.issueId}:transition:${input.targetStateId}`,
      projectId: issue.projectId,
      issueId: input.issueId,
      actor: input.actor,
      action: "issue.transitioned",
      payload: {
        fromStateId: currentState.id,
        toStateId: targetState.id,
        fromCategory: currentState.category,
        toCategory: targetState.category,
      },
    });

    return this.requireIssue(input.issueId);
  }

  getById(issueId: string): IssueRow {
    return this.requireIssue(issueId);
  }

  private requireIssue(issueId: string): IssueRow {
    const issue = this.issues.getIssueById(issueId);
    if (!issue) throw new Error(`Issue not found: ${issueId}`);
    return issue;
  }

  private requireState(stateId: string): {
    id: string;
    projectId: string;
    category: WorkflowStateCategory;
  } {
    const state = this.workflowStates.getWorkflowStateById(stateId);
    if (!state) throw new Error(`Workflow state not found: ${stateId}`);
    return { id: state.id, projectId: state.projectId, category: state.category };
  }
}

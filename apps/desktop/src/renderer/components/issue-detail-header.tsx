import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@symphony/ui";
import { ArrowLeft, FileText } from "lucide-react";
import { formatIssuePriority } from "@/renderer/components/issue-card";
import {
  IssueStateSelect,
  type WorkflowStateOption,
} from "@/renderer/components/issue-state-select";
import { PageHeader } from "@/renderer/layout/page-header";
import type { IssueDetail } from "@/ipc";

type IssueDetailHeaderProps = {
  issue: IssueDetail;
  workflowStates?: WorkflowStateOption[];
  onStateChange?: (targetStateId: string) => Promise<void>;
  isTransitionPending?: boolean;
  transitionError?: Error | null;
};

export function IssueDetailHeader({
  issue,
  workflowStates = [],
  onStateChange,
  isTransitionPending = false,
  transitionError = null,
}: IssueDetailHeaderProps): React.JSX.Element {
  const priority = formatIssuePriority(issue.priority);
  const canChangeState = Boolean(onStateChange) && workflowStates.length > 0;

  return (
    <div className="space-y-4">
      <Link
        to="/board"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to board
      </Link>

      <PageHeader
        eyebrow={issue.identifier}
        icon={FileText}
        title={issue.title}
        description={
          issue.description
            ? issue.description.length > 160
              ? `${issue.description.slice(0, 160)}…`
              : issue.description
            : "No description provided."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canChangeState && onStateChange ? (
              <IssueStateSelect
                currentStateId={issue.workflowStateId}
                currentStateName={issue.workflowStateName}
                states={workflowStates}
                onStateChange={onStateChange}
                isPending={isTransitionPending}
                submitError={transitionError}
              />
            ) : (
              <Badge variant="secondary">{issue.workflowStateName}</Badge>
            )}
            {priority ? <Badge variant="outline">{priority}</Badge> : null}
          </div>
        }
      />
    </div>
  );
}

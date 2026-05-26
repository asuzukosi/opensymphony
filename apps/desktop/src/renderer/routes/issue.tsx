import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { IssueCommentsSection } from "@/renderer/components/issue-comments-section";
import { IssueDetailHeader } from "@/renderer/components/issue-detail-header";
import { IssueErrorAlert } from "@/renderer/components/issue-error-alert";
import { IssueLoadingState } from "@/renderer/components/issue-loading-state";
import { IssueMetadata } from "@/renderer/components/issue-metadata";
import { IssueNotFoundState } from "@/renderer/components/issue-not-found-state";
import { IssueRunHistoryTable } from "@/renderer/components/issue-run-history-table";
import { PageShell } from "@/renderer/layout/page-shell";
import { useIssue, useMutateIssue, useProjectBoard } from "@/renderer/hooks";

function isIssueNotFoundError(error: Error): boolean {
  return error.message.includes("issue not found");
}

export function Issue(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const issueId = id ?? null;
  const { issue, error, isLoading, refetch } = useIssue({ issueId });
  const { board } = useProjectBoard({ enabled: issueId != null });
  const {
    addComment,
    transition,
    isPending: isMutatePending,
    error: mutateError,
    reset: resetMutate,
  } = useMutateIssue();
  const [failedAction, setFailedAction] = useState<"comment" | "transition" | null>(null);
  const isInitialLoading = isLoading && !issue;

  const workflowStates = useMemo(
    () =>
      board?.columns.map((column) => ({
        stateId: column.stateId,
        stateName: column.stateName,
      })) ?? [],
    [board],
  );

  const handleAddComment = async (body: string): Promise<void> => {
    if (!issue) {
      return;
    }

    resetMutate();
    setFailedAction(null);
    try {
      await addComment({
        issueId: issue.issueId,
        body,
      });
      await refetch();
    } catch {
      setFailedAction("comment");
    }
  };

  const handleStateChange = async (targetStateId: string): Promise<void> => {
    if (!issue || targetStateId === issue.workflowStateId) {
      return;
    }

    resetMutate();
    setFailedAction(null);
    try {
      await transition({
        issueId: issue.issueId,
        targetStateId,
      });
      await refetch();
    } catch {
      setFailedAction("transition");
    }
  };

  if (!issueId) {
    return (
      <PageShell>
        <IssueNotFoundState issueId="unknown" />
      </PageShell>
    );
  }

  if (isInitialLoading) {
    return (
      <PageShell>
        <IssueLoadingState />
      </PageShell>
    );
  }

  if (!issue) {
    if (error && isIssueNotFoundError(error)) {
      return (
        <PageShell>
          <IssueNotFoundState issueId={issueId} />
        </PageShell>
      );
    }

    return (
      <PageShell>
        <IssueNotFoundState issueId={issueId} />
        {error ? <IssueErrorAlert error={error} /> : null}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <IssueDetailHeader
        issue={issue}
        workflowStates={workflowStates}
        onStateChange={handleStateChange}
        isTransitionPending={isMutatePending}
        transitionError={failedAction === "transition" ? mutateError : null}
      />
      {error ? <IssueErrorAlert error={error} /> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <IssueMetadata issue={issue} />
          <IssueCommentsSection
            comments={issue.comments}
            onAddComment={handleAddComment}
            isPending={isMutatePending}
            submitError={failedAction === "comment" ? mutateError : null}
          />
        </div>
        <div className="lg:col-span-1">
          <IssueRunHistoryTable attempts={issue.attempts} />
        </div>
      </div>
    </PageShell>
  );
}

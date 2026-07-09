"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { IssueCommentsSection } from "@/components/issue/issue-comments-section";
import { IssueDetailHeader } from "@/components/issue/issue-detail-header";
import { IssueMetadata } from "@/components/issue/issue-metadata";
import { IssuePermissionsPanel } from "@/components/issue/issue-permissions-panel";
import { IssueRunHistoryTable } from "@/components/issue/issue-run-history-table";
import {
  IssueErrorAlert,
  IssueLoadingState,
  IssueNotFoundState,
  isIssueNotFoundError,
} from "@/components/issue/issue-states";
import { PageShell } from "@/components/layout/page-shell";
import { useIssue } from "@/hooks/use-issue";
import type { BoardColumnId } from "@/lib/ipc/types";

export function IssuePageClient() {
  const params = useParams<{ id: string }>();
  const issueId = params.id ?? null;
  const {
    issue,
    error,
    isLoading,
    transitionColumn,
    addComment,
    isMutating,
    mutationError,
    resetMutation,
  } = useIssue({ issueId });
  const [failedTransition, setFailedTransition] = useState(false);
  const [failedComment, setFailedComment] = useState(false);
  const isInitialLoading = isLoading && issue === undefined;

  const handleColumnChange = async (column: BoardColumnId): Promise<void> => {
    if (!issue || column === issue.boardColumn) {
      return;
    }

    resetMutation();
    setFailedTransition(false);

    try {
      await transitionColumn(column, "operator");
    } catch {
      setFailedTransition(true);
    }
  };

  const handleAddComment = async (body: string): Promise<void> => {
    resetMutation();
    setFailedComment(false);

    try {
      await addComment(body);
    } catch (error) {
      setFailedComment(true);
      throw error;
    }
  };

  if (issueId == null) {
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
    return (
      <PageShell>
        {error && !isIssueNotFoundError(error) ? <IssueErrorAlert error={error} /> : null}
        <IssueNotFoundState issueId={issueId} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <IssueDetailHeader
        issue={issue}
        onColumnChange={handleColumnChange}
        isTransitionPending={isMutating}
        transitionError={failedTransition ? mutationError : null}
      />
      {error ? <IssueErrorAlert error={error} /> : null}
      <IssuePermissionsPanel issueId={issueId} attempts={issue.attempts} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <IssueMetadata issue={issue} />
          <IssueCommentsSection
            comments={issue.comments}
            onAddComment={handleAddComment}
            isPending={isMutating}
            submitError={failedComment ? mutationError : null}
          />
        </div>
        <div className="lg:col-span-1">
          <IssueRunHistoryTable attempts={issue.attempts} sessionEvents={issue.sessionEvents} />
        </div>
      </div>
    </PageShell>
  );
}

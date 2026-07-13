"use client";

import { IssueAddCommentForm } from "@/components/issue/issue-add-comment-form";
import { IssueCommentsList } from "@/components/issue/issue-comments-list";
import { IssueDetailSection } from "@/components/issue/issue-detail-section";
import type { IssueComment } from "@/lib/ipc/types";

type IssueCommentsSectionProps = {
  comments: IssueComment[];
  onAddComment?: (body: string) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function IssueCommentsSection({
  comments,
  onAddComment,
  isPending = false,
  submitError = null,
}: IssueCommentsSectionProps) {
  return (
    <IssueDetailSection
      title="Comments"
      description={
        comments.length === 0
          ? "No comments on this issue yet."
          : `${comments.length} comment${comments.length === 1 ? "" : "s"}.`
      }
    >
      <IssueCommentsList comments={comments} />
      {onAddComment != null ? (
        <IssueAddCommentForm
          onSubmit={onAddComment}
          isPending={isPending}
          submitError={submitError}
        />
      ) : null}
    </IssueDetailSection>
  );
}

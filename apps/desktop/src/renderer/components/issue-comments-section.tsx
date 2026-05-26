import React from "react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@symphony/ui";
import { IssueAddCommentForm } from "@/renderer/components/issue-add-comment-form";
import { IssueCommentsList } from "@/renderer/components/issue-comments-list";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import type { IssueDetailComment } from "@/ipc";

type IssueCommentsSectionProps = {
  comments: IssueDetailComment[];
  onAddComment: (body: string) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function IssueCommentsSection({
  comments,
  onAddComment,
  isPending = false,
  submitError = null,
}: IssueCommentsSectionProps): React.JSX.Element {
  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Comments</CardTitle>
        <CardDescription>
          {comments.length === 0
            ? "No comments on this issue yet."
            : `${comments.length} comment${comments.length === 1 ? "" : "s"}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <IssueCommentsList comments={comments} />
        <IssueAddCommentForm
          onSubmit={onAddComment}
          isPending={isPending}
          submitError={submitError}
        />
      </CardContent>
    </SurfaceCard>
  );
}

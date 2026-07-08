"use client";

import { IssueAddCommentForm } from "@/components/issue/issue-add-comment-form";
import { IssueCommentsList } from "@/components/issue/issue-comments-list";
import { SurfaceCard } from "@/components/layout/surface-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IssueComment } from "@/lib/ipc/types";

type IssueCommentsSectionProps = {
  comments: IssueComment[];
  onAddComment: (body: string) => Promise<void>;
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

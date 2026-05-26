import React from "react";
import type { IssueDetailComment } from "@/ipc";

type IssueCommentsListProps = {
  comments: IssueDetailComment[];
};

function formatCommentTime(createdAt: string): string {
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) {
    return createdAt;
  }
  return new Date(parsed).toLocaleString();
}

export function IssueCommentsList({ comments }: IssueCommentsListProps): React.JSX.Element {
  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  }

  return (
    <ul className="space-y-4">
      {comments.map((comment) => (
        <li key={comment.id} className="space-y-1 border-b pb-4 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{comment.authorId ?? "Unknown author"}</span>
            <time dateTime={comment.createdAt}>{formatCommentTime(comment.createdAt)}</time>
          </div>
          <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
        </li>
      ))}
    </ul>
  );
}

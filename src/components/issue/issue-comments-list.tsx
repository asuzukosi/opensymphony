import { formatDateTime } from "@/lib/datetime";
import type { IssueComment } from "@/lib/ipc/types";

type IssueCommentsListProps = {
  comments: IssueComment[];
};

export function IssueCommentsList({ comments }: IssueCommentsListProps) {
  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  }

  return (
    <ul className="space-y-4">
      {comments.map((comment) => (
        <li key={comment.id} className="space-y-1 border-b pb-4 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{comment.author ?? "Unknown author"}</span>
            <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
          </div>
          <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
        </li>
      ))}
    </ul>
  );
}

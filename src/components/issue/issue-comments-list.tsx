import { IssueCommentBody } from "@/components/issue/issue-comment-body";
import { formatDateTime } from "@/lib/datetime";
import type { IssueComment } from "@/lib/ipc/types";

type IssueCommentsListProps = {
  comments: IssueComment[];
};

export function IssueCommentsList({ comments }: IssueCommentsListProps) {
  if (comments.length === 0) {
    return <p className="text-xs text-muted-foreground">No comments yet.</p>;
  }

  return (
    <ul className="min-w-0 space-y-4">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="min-w-0 space-y-1 border-b border-border/40 pb-4 last:border-0 last:pb-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="min-w-0 break-words">{comment.author ?? "Unknown author"}</span>
            <time className="shrink-0" dateTime={comment.createdAt}>
              {formatDateTime(comment.createdAt)}
            </time>
          </div>
          <IssueCommentBody body={comment.body} />
        </li>
      ))}
    </ul>
  );
}

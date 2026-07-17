import { TaskCommentBody } from "@/components/task/task-comment-body";
import { formatDateTime } from "@/lib/datetime";
import type { TaskComment } from "@/lib/ipc/types";

type TaskCommentsListProps = {
  comments: TaskComment[];
};

export function TaskCommentsList({ comments }: TaskCommentsListProps) {
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
          <TaskCommentBody body={comment.body} />
        </li>
      ))}
    </ul>
  );
}

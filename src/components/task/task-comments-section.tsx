"use client";

import { TaskAddCommentForm } from "@/components/task/task-add-comment-form";
import { TaskCommentsList } from "@/components/task/task-comments-list";
import { TaskDetailSection } from "@/components/task/task-detail-section";
import type { TaskComment } from "@/lib/ipc/types";

type TaskCommentsSectionProps = {
  comments: TaskComment[];
  onAddComment?: (body: string) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function TaskCommentsSection({
  comments,
  onAddComment,
  isPending = false,
  submitError = null,
}: TaskCommentsSectionProps) {
  return (
    <TaskDetailSection
      title="Comments"
      description={
        comments.length === 0
          ? "No comments on this task yet."
          : `${comments.length} comment${comments.length === 1 ? "" : "s"}.`
      }
    >
      <TaskCommentsList comments={comments} />
      {onAddComment != null ? (
        <TaskAddCommentForm
          onSubmit={onAddComment}
          isPending={isPending}
          submitError={submitError}
        />
      ) : null}
    </TaskDetailSection>
  );
}

"use client";

import { BoardColumnBadge } from "@/components/board/board-column-badge";
import { TaskCommentsSection } from "@/components/task/task-comments-section";
import { TaskMetadata } from "@/components/task/task-metadata";
import { TaskPermissionsPanel } from "@/components/task/task-permissions-panel";
import { TaskPriorityBadge } from "@/components/task/task-priority";
import { TaskRunHistoryTable } from "@/components/task/task-run-history-table";
import {
  TaskErrorAlert,
  TaskNotFoundState,
  isTaskNotFoundError,
} from "@/components/task/task-states";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useTask } from "@/hooks/use-task";
import { useTaskSheetParams } from "@/lib/task-sheet-params";
import { cn, wrapText, wrapTextPreserve } from "@/lib/utils";

function TaskSheetLoadingState() {
  return (
    <div className="space-y-4 pr-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function TaskDetailSheetContent({ taskId }: { taskId: string }) {
  const { task, error, isLoading, addComment, isMutating, mutationError } = useTask({
    taskId,
    enabled: true,
  });
  const isInitialLoading = isLoading && task === undefined;

  if (isInitialLoading) {
    return (
      <>
        <SheetTitle className="sr-only">Loading task</SheetTitle>
        <TaskSheetLoadingState />
      </>
    );
  }

  if (!task) {
    return (
      <>
        <SheetTitle className="sr-only">Task not found</SheetTitle>
        <div className="space-y-4">
          {error && !isTaskNotFoundError(error) ? <TaskErrorAlert error={error} /> : null}
          <TaskNotFoundState taskId={taskId} />
        </div>
      </>
    );
  }

  return (
    <article className="min-w-0 divide-y divide-border/60 pr-6">
      <header className="space-y-3 pb-6">
        <SheetTitle className={cn("text-sm font-medium leading-snug", wrapText)}>
          {task.title}
        </SheetTitle>
        <SheetDescription className={cn("text-xs", wrapTextPreserve)}>
          {task.description ?? "No description provided."}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-2">
          <BoardColumnBadge columnId={task.boardColumn} />
          <TaskPriorityBadge priority={task.priority} className="text-[10px]" />
        </div>
      </header>

      {error ? (
        <div className="py-6">
          <TaskErrorAlert error={error} />
        </div>
      ) : null}

      <div className="py-6 empty:hidden">
        <TaskPermissionsPanel taskId={taskId} attempts={task.attempts} />
      </div>

      <div className="space-y-8 py-6">
        <TaskMetadata task={task} />
        <TaskCommentsSection
          comments={task.comments}
          onAddComment={addComment}
          isPending={isMutating}
          submitError={mutationError}
        />
        <TaskRunHistoryTable attempts={task.attempts} sessionEvents={task.sessionEvents} />
      </div>
    </article>
  );
}

type TaskDetailSheetProps = {
  taskId: string | null;
  open: boolean;
  onClose: () => void;
};

export function TaskDetailSheet({ taskId, open, onClose }: TaskDetailSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <SheetContent side="right" className="w-full min-w-0 overflow-y-auto sm:max-w-xl">
        {taskId != null ? <TaskDetailSheetContent taskId={taskId} /> : null}
      </SheetContent>
    </Sheet>
  );
}

export function TaskSheetHost() {
  const { taskId, isOpen, closeTaskSheet } = useTaskSheetParams();

  return <TaskDetailSheet taskId={taskId} open={isOpen} onClose={closeTaskSheet} />;
}

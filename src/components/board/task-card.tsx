"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { TaskPriorityBadge } from "@/components/task/task-priority";
import { PlatformAvatar } from "@/components/ui/platform-avatar";
import type { ProjectBoardTask } from "@/lib/ipc/types";
import { cn, summarizeText, wrapText } from "@/lib/utils";

type TaskCardContentProps = {
  task: ProjectBoardTask;
  disabled?: boolean;
  onOpen?: (task: ProjectBoardTask) => void;
};

function TaskCardContent({
  task,
  disabled = false,
  onOpen,
}: TaskCardContentProps) {
  const summary = task.description?.trim() ? summarizeText(task.description, 72) : null;

  return (
    <article
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-border/50 bg-card p-3 text-card-foreground shadow-sm transition-shadow",
        onOpen && "cursor-pointer hover:border-border hover:shadow-md",
        disabled && "opacity-60",
      )}
      onClick={() => {
        onOpen?.(task);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={cn("min-w-0 flex-1 text-xs font-medium leading-snug", wrapText)}>
          {task.title}
        </h3>
        <TaskPriorityBadge priority={task.priority} className="shrink-0" />
      </div>

      {summary ? (
        <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
          {summary}
        </p>
      ) : null}

      {task.executor != null ? (
        <div className={cn("flex items-center", summary ? "mt-2" : "mt-2.5")}>
          <PlatformAvatar platformId={task.executor} size="sm" />
        </div>
      ) : null}
    </article>
  );
}

type TaskCardProps = {
  task: ProjectBoardTask;
  isOverlay?: boolean;
  disabled?: boolean;
  dragEnabled?: boolean;
  onOpen?: (task: ProjectBoardTask) => void;
};

function DraggableTaskCard({
  task,
  disabled = false,
  onOpen,
}: Omit<TaskCardProps, "isOverlay" | "dragEnabled">) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.taskId,
    data: { task },
    disabled,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("touch-none min-w-0", isDragging && "opacity-50")}
      {...listeners}
      {...attributes}
    >
      <TaskCardContent task={task} disabled={disabled} onOpen={onOpen} />
    </div>
  );
}

export function TaskCard({
  task,
  isOverlay = false,
  disabled = false,
  dragEnabled = false,
  onOpen,
}: TaskCardProps) {
  if (isOverlay) {
    return (
      <div className="rotate-1 shadow-lg">
        <TaskCardContent task={task} disabled />
      </div>
    );
  }

  if (dragEnabled) {
    return <DraggableTaskCard task={task} disabled={disabled} onOpen={onOpen} />;
  }

  return <TaskCardContent task={task} disabled={disabled} onOpen={onOpen} />;
}

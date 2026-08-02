"use client";

import { TaskPriorityBadge } from "@/components/task/task-priority";
import { PlatformAvatar } from "@/components/ui/platform-avatar";
import type { ProjectBoardTask } from "@/lib/ipc/types";
import { cn, summarizeText, wrapText } from "@/lib/utils";

type TaskCardProps = {
  task: ProjectBoardTask;
  isOverlay?: boolean;
  disabled?: boolean;
  onOpen?: (task: ProjectBoardTask) => void;
};

export function TaskCard({ task, isOverlay = false, disabled = false, onOpen }: TaskCardProps) {
  const summary = task.description?.trim() ? summarizeText(task.description, 72) : null;

  return (
    <article
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-border/50 bg-card p-3 text-card-foreground shadow-sm transition-shadow",
        onOpen && "cursor-pointer hover:border-border hover:shadow-md",
        disabled && "opacity-60",
        isOverlay && "rotate-1 shadow-lg",
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

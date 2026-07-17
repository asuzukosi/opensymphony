"use client";

import { useDroppable } from "@dnd-kit/core";
import { PlusIcon } from "@/components/ui/hero-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/board/task-card";
import {
  BoardColumnBodySkeleton,
  BoardColumnCountSkeleton,
  BoardColumnEmptyState,
  BoardColumnErrorState,
  BOARD_COLUMN_COUNT_ICONS,
  BOARD_COLUMN_LABELS,
} from "@/components/board/board-states";
import type { BoardColumnId, ProjectBoardTask } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

type BoardColumnProps = {
  columnId: BoardColumnId;
  tasks?: ProjectBoardTask[];
  isLoading?: boolean;
  error?: Error | null;
  onAddTask?: () => void;
  onTaskOpen?: (task: ProjectBoardTask) => void;
  disabled?: boolean;
  dragEnabled?: boolean;
};

export function BoardColumn({
  columnId,
  tasks,
  isLoading = false,
  error = null,
  onAddTask,
  onTaskOpen,
  disabled = false,
  dragEnabled = false,
}: BoardColumnProps) {
  const label = BOARD_COLUMN_LABELS[columnId];
  const CountIcon = BOARD_COLUMN_COUNT_ICONS[columnId];
  const taskCount = tasks?.length ?? 0;
  const canCreateTask = columnId === "backlog" && onAddTask != null;
  const isInitialLoading = isLoading && tasks === undefined;
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { columnId },
    disabled: disabled || !dragEnabled,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 shrink-0 space-y-2">
        <h2 className="text-xs font-medium tracking-tight">{label}</h2>
        {isInitialLoading ? (
          <BoardColumnCountSkeleton />
        ) : (
          <Badge
            variant="outline"
            className="h-5 w-fit gap-1 rounded-full px-2 py-0 text-[10px] font-normal tabular-nums"
          >
            <CountIcon data-icon="inline-start" className="size-3" />
            {taskCount} {taskCount === 1 ? "task" : "tasks"}
          </Badge>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        {error ? (
          <BoardColumnErrorState error={error} />
        ) : isInitialLoading ? (
          <BoardColumnBodySkeleton />
        ) : (
          <div
            ref={setNodeRef}
            className={cn(
              "min-h-[10rem] space-y-3 rounded-lg transition-colors",
              dragEnabled && isOver && "bg-accent/30 ring-1 ring-inset ring-primary/20",
            )}
          >
            {taskCount === 0 ? (
              <BoardColumnEmptyState showCreateHint={canCreateTask} />
            ) : (
              <ul className="space-y-3">
                {tasks?.map((task) => (
                  <li key={task.taskId} className="min-w-0">
                    <TaskCard
                      task={task}
                      disabled={disabled}
                      dragEnabled={dragEnabled}
                      onOpen={onTaskOpen}
                    />
                  </li>
                ))}
              </ul>
            )}

            {canCreateTask ? (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2 font-normal"
                disabled={disabled}
                onClick={onAddTask}
              >
                <PlusIcon className="size-4" />
                Add
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

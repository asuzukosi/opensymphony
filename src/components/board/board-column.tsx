"use client";

import { useDroppable } from "@dnd-kit/core";
import { PlusIcon } from "@/components/ui/hero-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IssueCard } from "@/components/board/issue-card";
import {
  BoardColumnBodySkeleton,
  BoardColumnCountSkeleton,
  BoardColumnEmptyState,
  BoardColumnErrorState,
  BOARD_COLUMN_COUNT_ICONS,
  BOARD_COLUMN_LABELS,
} from "@/components/board/board-states";
import type { BoardColumnId, ProjectBoardIssue } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

type BoardColumnProps = {
  columnId: BoardColumnId;
  issues?: ProjectBoardIssue[];
  isLoading?: boolean;
  error?: Error | null;
  onAddTask?: () => void;
  onIssueOpen?: (issue: ProjectBoardIssue) => void;
  disabled?: boolean;
  dragEnabled?: boolean;
};

export function BoardColumn({
  columnId,
  issues,
  isLoading = false,
  error = null,
  onAddTask,
  onIssueOpen,
  disabled = false,
  dragEnabled = false,
}: BoardColumnProps) {
  const label = BOARD_COLUMN_LABELS[columnId];
  const CountIcon = BOARD_COLUMN_COUNT_ICONS[columnId];
  const issueCount = issues?.length ?? 0;
  const canCreateIssue = columnId === "backlog" && onAddTask != null;
  const isInitialLoading = isLoading && issues === undefined;
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
            {issueCount} {issueCount === 1 ? "task" : "tasks"}
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
            {issueCount === 0 ? (
              <BoardColumnEmptyState showCreateHint={canCreateIssue} />
            ) : (
              <ul className="space-y-3">
                {issues?.map((issue) => (
                  <li key={issue.issueId} className="min-w-0">
                    <IssueCard
                      issue={issue}
                      disabled={disabled}
                      dragEnabled={dragEnabled}
                      onOpen={onIssueOpen}
                    />
                  </li>
                ))}
              </ul>
            )}

            {canCreateIssue ? (
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

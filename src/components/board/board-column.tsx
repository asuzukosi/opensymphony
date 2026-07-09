"use client";

import { useDroppable } from "@dnd-kit/core";
import { EllipsisHorizontalIcon, PlusIcon } from "@/components/ui/hero-icons";

import { Button } from "@/components/ui/button";
import { IssueCard } from "@/components/board/issue-card";
import {
  BoardColumnBodySkeleton,
  BoardColumnCountSkeleton,
  BoardColumnEmptyState,
  BoardColumnErrorState,
  BOARD_COLUMN_LABELS,
} from "@/components/board/board-states";
import type { BoardColumnId, ProjectBoardIssue } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

export { BOARD_COLUMN_LABELS };

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
      <div className="mb-4 flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-xs font-medium tracking-tight">{label}</h2>
          {isInitialLoading ? (
            <BoardColumnCountSkeleton />
          ) : (
            <p className="text-sm text-muted-foreground">
              {issueCount} {issueCount === 1 ? "task" : "tasks"}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label={`${label} column options`}
          disabled
        >
          <EllipsisHorizontalIcon className="size-4" />
        </Button>
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
                  <li key={issue.issueId}>
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

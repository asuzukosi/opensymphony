"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";

import { SurfaceCard } from "@/components/layout/surface-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
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
    <SurfaceCard className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-2 space-y-0 border-b border-border/60 pb-3">
        <div className="space-y-2">
          <CardTitle className="text-base">{label}</CardTitle>
          {isInitialLoading ? (
            <BoardColumnCountSkeleton />
          ) : (
            <Badge variant="secondary" className="font-normal">
              {issueCount} {issueCount === 1 ? "task" : "tasks"}
            </Badge>
          )}
        </div>
        {canCreateIssue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={`Add task to ${label}`}
            disabled={disabled}
            onClick={onAddTask}
          >
            <Plus className="size-4" />
          </Button>
        ) : null}
      </CardHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-3">
        {error ? (
          <BoardColumnErrorState error={error} />
        ) : isInitialLoading ? (
          <BoardColumnBodySkeleton />
        ) : (
          <div
            ref={setNodeRef}
            className={cn(
              "min-h-[12rem] space-y-2 rounded-lg border border-dashed border-transparent bg-muted/20 p-2 transition-colors",
              dragEnabled && isOver && "border-primary/40 bg-accent/40",
              issueCount === 0 && "border-border/70",
            )}
          >
            {issueCount === 0 ? (
              <BoardColumnEmptyState showCreateHint={canCreateIssue} />
            ) : (
              <ul className="space-y-2">
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
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import {
  Button,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@symphony/ui";
import { IssueCard } from "@/renderer/components/issue-card";
import { BoardColumnEmptyState } from "@/renderer/components/board-column-empty-state";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import { canCreateIssueInColumn } from "@/renderer/lib/board-create-utils";
import {
  surfaceColumnScrollClass,
  surfaceColumnShellClass,
} from "@/renderer/lib/surface-styles";
import type { ProjectBoardColumn } from "@/ipc";

type BoardColumnProps = {
  column: ProjectBoardColumn;
  onAddTask: (stateId: string) => void;
  onIssueOpen?: (issue: ProjectBoardColumn["issues"][number]) => void;
  disabled?: boolean;
};

export function BoardColumn({
  column,
  onAddTask,
  onIssueOpen,
  disabled = false,
}: BoardColumnProps): React.JSX.Element {
  const canCreateIssue = canCreateIssueInColumn(column);
  const { setNodeRef, isOver } = useDroppable({
    id: column.stateId,
    data: { column },
    disabled,
  });

  return (
    <SurfaceCard className={surfaceColumnShellClass}>
      <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">{column.stateName}</CardTitle>
          <CardDescription>
            {column.issues.length} {column.issues.length === 1 ? "task" : "tasks"}
          </CardDescription>
        </div>
        {canCreateIssue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={`Add task to ${column.stateName}`}
            disabled={disabled}
            onClick={() => onAddTask(column.stateId)}
          >
            <Plus className="size-4" />
          </Button>
        ) : null}
      </CardHeader>
      <div className={surfaceColumnScrollClass}>
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-[12rem] space-y-2 rounded-lg border border-dashed border-transparent bg-muted/20 p-2 transition-colors",
            isOver && "border-primary/40 bg-accent/40",
            column.issues.length === 0 && "border-border/70",
          )}
        >
          {column.issues.length === 0 ? (
            <BoardColumnEmptyState />
          ) : (
            column.issues.map((issue) => (
              <IssueCard key={issue.issueId} issue={issue} disabled={disabled} onOpen={onIssueOpen} />
            ))
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}

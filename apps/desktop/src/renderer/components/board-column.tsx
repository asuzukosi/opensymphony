import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import {
  Button,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  ScrollArea,
} from "@symphony/ui";
import { IssueCard } from "@/renderer/components/issue-card";
import { BoardColumnEmptyState } from "@/renderer/components/board-column-empty-state";
import { SurfaceCard } from "@/renderer/layout/surface-card";
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
  const { setNodeRef, isOver } = useDroppable({
    id: column.stateId,
    data: { column },
    disabled,
  });

  return (
    <SurfaceCard className="flex max-h-[calc(100vh-12rem)] min-h-[28rem] flex-col">
      <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">{column.stateName}</CardTitle>
          <CardDescription>
            {column.issues.length} {column.issues.length === 1 ? "task" : "tasks"}
          </CardDescription>
        </div>
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
      </CardHeader>
      <ScrollArea className="min-h-0 flex-1 px-3 pb-3">
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-[20rem] space-y-2 rounded-lg border border-dashed border-transparent bg-muted/20 p-2 transition-colors",
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
      </ScrollArea>
    </SurfaceCard>
  );
}

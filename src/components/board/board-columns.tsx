"use client";

import { BoardColumnBadge } from "@/components/board/board-column-badge";
import {
  BOARD_COLUMN_LABELS,
  BoardColumnBodySkeleton,
  BoardColumnEmptyState,
  BoardColumnErrorState,
} from "@/components/board/board-states";
import { TaskCard } from "@/components/board/task-card";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  type KanbanCommitMeta,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/hero-icons";
import { BOARD_COLUMN_IDS, type BoardColumnId, type ProjectBoardTask } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

export type BoardColumnMeta = {
  isLoading: boolean;
  error: Error | null;
};

type BoardColumnsProps = {
  columns: Record<BoardColumnId, ProjectBoardTask[]>;
  onColumnsChange: (columns: Record<BoardColumnId, ProjectBoardTask[]>) => void;
  onColumnsCommit: (
    columns: Record<BoardColumnId, ProjectBoardTask[]>,
    meta: KanbanCommitMeta<ProjectBoardTask>,
  ) => void;
  columnMeta: Record<BoardColumnId, BoardColumnMeta>;
  className?: string;
  onAddTask?: () => void;
  onTaskOpen?: (task: ProjectBoardTask) => void;
  disabled?: boolean;
};

export function BoardColumns({
  columns,
  onColumnsChange,
  onColumnsCommit,
  columnMeta,
  className,
  onAddTask,
  onTaskOpen,
  disabled = false,
}: BoardColumnsProps) {
  return (
    <Kanban
      value={columns}
      onValueChange={(next) => onColumnsChange(next as Record<BoardColumnId, ProjectBoardTask[]>)}
      getItemValue={(item) => item.taskId}
      onValueCommit={(next, meta) =>
        onColumnsCommit(next as Record<BoardColumnId, ProjectBoardTask[]>, meta)
      }
      className={cn("min-h-0 flex-1 overflow-hidden", className)}
    >
      <KanbanBoard className="flex h-full min-h-0 gap-board-column overflow-x-auto pb-2">
        {BOARD_COLUMN_IDS.map((columnId) => {
          const tasks = columns[columnId];
          const meta = columnMeta[columnId];
          const canCreate = columnId === "backlog" && onAddTask != null;

          return (
            <KanbanColumn
              key={columnId}
              value={columnId}
              className="flex h-full w-board-column shrink-0 flex-col"
            >
              <Frame
                variant="ghost"
                spacing="xs"
                className="flex h-full min-h-0 flex-col bg-transparent p-0 [--frame-panel-radius:var(--frame-radius)]"
              >
                <FramePanel className="flex min-h-0 flex-1 flex-col gap-2 border-border/50">
                  <FrameHeader className="flex flex-row items-center justify-between gap-2 px-0 py-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <FrameTitle className="sr-only">{BOARD_COLUMN_LABELS[columnId]}</FrameTitle>
                      <BoardColumnBadge columnId={columnId} />
                      <Badge variant="outline" size="xs" radius="full">
                        {tasks.length}
                      </Badge>
                    </div>
                    {canCreate ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        disabled={disabled}
                        onClick={onAddTask}
                      >
                        <PlusIcon className="size-3.5" />
                        Add
                      </Button>
                    ) : null}
                  </FrameHeader>

                  {meta.error ? (
                    <BoardColumnErrorState error={meta.error} />
                  ) : meta.isLoading ? (
                    <BoardColumnBodySkeleton />
                  ) : (
                    <KanbanColumnContent
                      value={columnId}
                      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
                    >
                      {tasks.length === 0 ? (
                        <BoardColumnEmptyState showCreateHint={canCreate} />
                      ) : (
                        tasks.map((task) => (
                          <KanbanItem key={task.taskId} value={task.taskId} disabled={disabled}>
                            <KanbanItemHandle>
                              <TaskCard task={task} disabled={disabled} onOpen={onTaskOpen} />
                            </KanbanItemHandle>
                          </KanbanItem>
                        ))
                      )}
                    </KanbanColumnContent>
                  )}
                </FramePanel>
              </Frame>
            </KanbanColumn>
          );
        })}
      </KanbanBoard>
      <KanbanOverlay>
        {({ value, variant }) => {
          if (variant !== "item") {
            return <div className="size-full rounded-xl border-2 border-dashed bg-muted/20" />;
          }
          const task = Object.values(columns)
            .flat()
            .find((entry) => entry.taskId === String(value));
          return task ? <TaskCard task={task} isOverlay disabled /> : null;
        }}
      </KanbanOverlay>
    </Kanban>
  );
}

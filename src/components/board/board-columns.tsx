"use client";

import { BoardColumn } from "@/components/board/board-column";
import { ColumnTrack, ColumnsScroller } from "@/components/layout/columns-scroller";
import {
  BOARD_COLUMN_IDS,
  type BoardColumnId,
  type ProjectBoardTask,
} from "@/lib/ipc/types";
export type BoardColumnMeta = {
  isLoading: boolean;
  error: Error | null;
};

type BoardColumnsProps = {
  columnMeta: Record<BoardColumnId, BoardColumnMeta>;
  getColumnTasks: (columnId: BoardColumnId) => ProjectBoardTask[] | undefined;
  className?: string;
  onAddTask?: (columnId: BoardColumnId) => void;
  onTaskOpen?: (task: ProjectBoardTask) => void;
  disabled?: boolean;
  dragEnabled?: boolean;
};

export function BoardColumns({
  columnMeta,
  getColumnTasks,
  className,
  onAddTask,
  onTaskOpen,
  disabled = false,
  dragEnabled = false,
}: BoardColumnsProps) {
  return (
    <ColumnsScroller className={className}>
      {BOARD_COLUMN_IDS.map((columnId) => (
        <ColumnTrack key={columnId}>
          <BoardColumn
            columnId={columnId}
            tasks={getColumnTasks(columnId)}
            isLoading={columnMeta[columnId].isLoading}
            error={columnMeta[columnId].error}
            disabled={disabled}
            dragEnabled={dragEnabled}
            onTaskOpen={onTaskOpen}
            onAddTask={
              onAddTask && columnId === "backlog" ? () => onAddTask(columnId) : undefined
            }
          />
        </ColumnTrack>
      ))}
    </ColumnsScroller>
  );
}

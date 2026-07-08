"use client";

import { BoardColumn } from "@/components/board/board-column";
import { ColumnTrack, ColumnsScroller } from "@/components/layout/columns-scroller";
import {
  BOARD_COLUMN_IDS,
  type BoardColumnId,
  type ProjectBoardIssue,
} from "@/lib/ipc/types";
export type BoardColumnMeta = {
  isLoading: boolean;
  error: Error | null;
};

type BoardColumnsProps = {
  columnMeta: Record<BoardColumnId, BoardColumnMeta>;
  getColumnIssues: (columnId: BoardColumnId) => ProjectBoardIssue[] | undefined;
  className?: string;
  onAddTask?: (columnId: BoardColumnId) => void;
  onIssueOpen?: (issue: ProjectBoardIssue) => void;
  disabled?: boolean;
  dragEnabled?: boolean;
};

export function BoardColumns({
  columnMeta,
  getColumnIssues,
  className,
  onAddTask,
  onIssueOpen,
  disabled = false,
  dragEnabled = false,
}: BoardColumnsProps) {
  return (
    <ColumnsScroller className={className}>
      {BOARD_COLUMN_IDS.map((columnId) => (
        <ColumnTrack key={columnId}>
          <BoardColumn
            columnId={columnId}
            issues={getColumnIssues(columnId)}
            isLoading={columnMeta[columnId].isLoading}
            error={columnMeta[columnId].error}
            disabled={disabled}
            dragEnabled={dragEnabled}
            onIssueOpen={onIssueOpen}
            onAddTask={
              onAddTask && columnId === "backlog" ? () => onAddTask(columnId) : undefined
            }
          />
        </ColumnTrack>
      ))}
    </ColumnsScroller>
  );
}

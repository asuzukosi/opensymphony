import React from "react";
import { BoardColumn } from "@/renderer/components/board-column";
import { ColumnTrack, ColumnsScroller } from "@/renderer/layout/columns-scroller";
import type { ProjectBoardColumn } from "@/ipc";

type BoardColumnsProps = {
  columns: ProjectBoardColumn[];
  onAddTask: (stateId: string, stateName: string) => void;
  onIssueOpen?: (issue: ProjectBoardColumn["issues"][number]) => void;
  disabled?: boolean;
};

export function BoardColumns({
  columns,
  onAddTask,
  onIssueOpen,
  disabled = false,
}: BoardColumnsProps): React.JSX.Element {
  return (
    <ColumnsScroller>
      {columns.map((column) => (
        <ColumnTrack key={column.stateId}>
          <BoardColumn
            column={column}
            disabled={disabled}
            onIssueOpen={onIssueOpen}
            onAddTask={(stateId) => onAddTask(stateId, column.stateName)}
          />
        </ColumnTrack>
      ))}
    </ColumnsScroller>
  );
}

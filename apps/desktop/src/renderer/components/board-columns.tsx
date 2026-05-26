import React from "react";
import { BoardColumn } from "@/renderer/components/board-column";
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
    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((column) => (
        <BoardColumn
          key={column.stateId}
          column={column}
          disabled={disabled}
          onAddTask={(stateId) => onAddTask(stateId, column.stateName)}
        />
      ))}
    </div>
  );
}

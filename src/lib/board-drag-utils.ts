import {
  BOARD_COLUMN_IDS,
  type BoardColumnId,
  type ProjectBoard,
  type ProjectBoardTask,
} from "@/lib/ipc/types";

export function isBoardColumnId(value: string): value is BoardColumnId {
  return (BOARD_COLUMN_IDS as readonly string[]).includes(value);
}

export function findTaskColumn(taskId: string, board: ProjectBoard): BoardColumnId | null {
  for (const columnId of BOARD_COLUMN_IDS) {
    if (board[columnId].tasks.some((task) => task.taskId === taskId)) {
      return columnId;
    }
  }
  return null;
}

export function findTaskById(taskId: string, board: ProjectBoard): ProjectBoardTask | null {
  for (const columnId of BOARD_COLUMN_IDS) {
    const task = board[columnId].tasks.find((entry) => entry.taskId === taskId);
    if (task) {
      return task;
    }
  }
  return null;
}

export function resolveDropTargetColumnId(
  overId: string,
  board: ProjectBoard,
): BoardColumnId | null {
  if (isBoardColumnId(overId)) {
    return overId;
  }
  return findTaskColumn(overId, board);
}

export function moveTaskBetweenColumns(
  board: ProjectBoard,
  taskId: string,
  sourceColumn: BoardColumnId,
  targetColumn: BoardColumnId,
): ProjectBoard {
  if (sourceColumn === targetColumn) {
    return board;
  }

  const task = findTaskById(taskId, board);
  if (!task) {
    return board;
  }

  return {
    ...board,
    [sourceColumn]: {
      tasks: board[sourceColumn].tasks.filter((entry) => entry.taskId !== taskId),
    },
    [targetColumn]: {
      tasks: [...board[targetColumn].tasks, task],
    },
  };
}

import {
  BOARD_COLUMN_IDS,
  type BoardColumnId,
  type ProjectBoardTask,
  type ProjectTaskListItem,
} from "@/lib/ipc/types";

export function groupTasksByColumn(
  tasks: ProjectTaskListItem[],
): Record<BoardColumnId, ProjectBoardTask[]> {
  const grouped = Object.fromEntries(
    BOARD_COLUMN_IDS.map((columnId) => [columnId, [] as ProjectBoardTask[]]),
  ) as Record<BoardColumnId, ProjectBoardTask[]>;

  for (const task of tasks) {
    const { boardColumn, ...card } = task;
    grouped[boardColumn].push(card);
  }

  return grouped;
}

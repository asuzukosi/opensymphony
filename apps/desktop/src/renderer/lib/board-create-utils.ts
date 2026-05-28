import type { ProjectBoardColumn } from "@/ipc";

type BoardColumnCreateTarget = Pick<ProjectBoardColumn, "stateId" | "stateName"> & {
  category?: ProjectBoardColumn["category"];
};

function isTodoColumn(column: BoardColumnCreateTarget): boolean {
  if (column.stateId.endsWith(":todo")) {
    return true;
  }

  const normalizedName = column.stateName.trim().toLowerCase();
  if (normalizedName === "todo" || normalizedName === "to do") {
    return true;
  }

  return column.category === "backlog";
}

export function canCreateIssueInColumn(column: BoardColumnCreateTarget): boolean {
  return isTodoColumn(column);
}

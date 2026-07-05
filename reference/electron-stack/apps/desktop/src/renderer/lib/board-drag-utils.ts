import type { ProjectBoard, ProjectBoardIssue } from "@/ipc";

export function findIssueColumn(
  issueId: string,
  columns: Array<{ stateId: string; issues: ProjectBoardIssue[] }>,
): string | null {
  for (const column of columns) {
    if (column.issues.some((issue) => issue.issueId === issueId)) {
      return column.stateId;
    }
  }
  return null;
}

export function findIssueById(
  issueId: string,
  columns: Array<{ issues: ProjectBoardIssue[] }>,
): ProjectBoardIssue | null {
  for (const column of columns) {
    const issue = column.issues.find((entry) => entry.issueId === issueId);
    if (issue) {
      return issue;
    }
  }
  return null;
}

export function resolveDropTargetStateId(
  overId: string,
  columns: Array<{ stateId: string; issues: ProjectBoardIssue[] }>,
): string | null {
  if (columns.some((column) => column.stateId === overId)) {
    return overId;
  }
  return findIssueColumn(overId, columns);
}

export function moveIssueBetweenColumns(
  board: ProjectBoard,
  issueId: string,
  sourceStateId: string,
  targetStateId: string,
): ProjectBoard {
  const issue = findIssueById(issueId, board.columns);
  if (!issue) {
    return board;
  }

  return {
    columns: board.columns.map((column) => {
      if (column.stateId === sourceStateId) {
        return {
          ...column,
          issues: column.issues.filter((entry) => entry.issueId !== issueId),
        };
      }
      if (column.stateId === targetStateId) {
        return {
          ...column,
          issues: [...column.issues, issue],
        };
      }
      return column;
    }),
  };
}

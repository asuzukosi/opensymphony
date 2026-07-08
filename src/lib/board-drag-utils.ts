import {
  BOARD_COLUMN_IDS,
  type BoardColumnId,
  type ProjectBoard,
  type ProjectBoardIssue,
} from "@/lib/ipc/types";

export function isBoardColumnId(value: string): value is BoardColumnId {
  return (BOARD_COLUMN_IDS as readonly string[]).includes(value);
}

export function findIssueColumn(issueId: string, board: ProjectBoard): BoardColumnId | null {
  for (const columnId of BOARD_COLUMN_IDS) {
    if (board[columnId].issues.some((issue) => issue.issueId === issueId)) {
      return columnId;
    }
  }
  return null;
}

export function findIssueById(issueId: string, board: ProjectBoard): ProjectBoardIssue | null {
  for (const columnId of BOARD_COLUMN_IDS) {
    const issue = board[columnId].issues.find((entry) => entry.issueId === issueId);
    if (issue) {
      return issue;
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
  return findIssueColumn(overId, board);
}

export function moveIssueBetweenColumns(
  board: ProjectBoard,
  issueId: string,
  sourceColumn: BoardColumnId,
  targetColumn: BoardColumnId,
): ProjectBoard {
  if (sourceColumn === targetColumn) {
    return board;
  }

  const issue = findIssueById(issueId, board);
  if (!issue) {
    return board;
  }

  return {
    ...board,
    [sourceColumn]: {
      issues: board[sourceColumn].issues.filter((entry) => entry.issueId !== issueId),
    },
    [targetColumn]: {
      issues: [...board[targetColumn].issues, issue],
    },
  };
}

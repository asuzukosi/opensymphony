import {
  BOARD_COLUMN_IDS,
  type BoardColumnId,
  type ProjectBoardIssue,
  type ProjectIssueListItem,
} from "@/lib/ipc/types";

export function groupIssuesByColumn(
  issues: ProjectIssueListItem[],
): Record<BoardColumnId, ProjectBoardIssue[]> {
  const grouped = Object.fromEntries(
    BOARD_COLUMN_IDS.map((columnId) => [columnId, [] as ProjectBoardIssue[]]),
  ) as Record<BoardColumnId, ProjectBoardIssue[]>;

  for (const issue of issues) {
    grouped[issue.boardColumn].push({
      issueId: issue.issueId,
      identifier: issue.identifier,
      title: issue.title,
      priority: issue.priority,
    });
  }

  return grouped;
}

import { describe, expect, test } from "vitest";
import {
  findIssueColumn,
  moveIssueBetweenColumns,
  resolveDropTargetStateId,
} from "@/renderer/lib/board-drag-utils";
import type { ProjectBoard } from "@/ipc";

const board: ProjectBoard = {
  columns: [
    {
      stateId: "p:todo",
      stateName: "Todo",
      issues: [
        {
          issueId: "i1",
          identifier: "SYM-1",
          title: "First",
          priority: 1,
        },
      ],
    },
    {
      stateId: "p:in_progress",
      stateName: "In Progress",
      issues: [],
    },
  ],
};

describe("board drag utils", () => {
  test("findIssueColumn resolves issue location", () => {
    expect(findIssueColumn("i1", board.columns)).toBe("p:todo");
    expect(findIssueColumn("missing", board.columns)).toBeNull();
  });

  test("resolveDropTargetStateId accepts column or issue ids", () => {
    expect(resolveDropTargetStateId("p:in_progress", board.columns)).toBe("p:in_progress");
    expect(resolveDropTargetStateId("i1", board.columns)).toBe("p:todo");
    expect(resolveDropTargetStateId("missing", board.columns)).toBeNull();
  });

  test("moveIssueBetweenColumns moves issue optimistically", () => {
    const next = moveIssueBetweenColumns(board, "i1", "p:todo", "p:in_progress");

    expect(next.columns[0]?.issues).toEqual([]);
    expect(next.columns[1]?.issues).toEqual([
      {
        issueId: "i1",
        identifier: "SYM-1",
        title: "First",
        priority: 1,
      },
    ]);
  });
});

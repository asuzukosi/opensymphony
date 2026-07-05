import { describe, expect, test } from "vitest";
import { canCreateIssueInColumn } from "@/renderer/lib/board-create-utils";

describe("board create utils", () => {
  test("allows issue creation only in todo columns", () => {
    expect(
      canCreateIssueInColumn({
        stateId: "symphony-local:todo",
        stateName: "Todo",
        category: "backlog",
      }),
    ).toBe(true);
    expect(
      canCreateIssueInColumn({
        stateId: "symphony-local:todo",
        stateName: "Todo",
      }),
    ).toBe(true);
    expect(
      canCreateIssueInColumn({
        stateId: "symphony-local:in_progress",
        stateName: "In Progress",
        category: "active",
      }),
    ).toBe(false);
    expect(
      canCreateIssueInColumn({
        stateId: "symphony-local:human_review",
        stateName: "Human Review",
        category: "active",
      }),
    ).toBe(false);
    expect(
      canCreateIssueInColumn({
        stateId: "symphony-local:done",
        stateName: "Done",
        category: "terminal",
      }),
    ).toBe(false);
  });
});

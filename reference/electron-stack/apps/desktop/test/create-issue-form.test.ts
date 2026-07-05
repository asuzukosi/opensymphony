import { describe, expect, test } from "vitest";
import { validateCreateIssueForm } from "@/renderer/lib/create-issue-form";

describe("create issue form", () => {
  test("requires a title", () => {
    expect(validateCreateIssueForm({ title: "  ", description: "", priorityInput: "" })).toEqual({
      valid: false,
      error: "Title is required",
    });
  });

  test("rejects invalid priority", () => {
    expect(
      validateCreateIssueForm({
        title: "Ship board",
        description: "",
        priorityInput: "high",
      }),
    ).toEqual({
      valid: false,
      error: "Priority must be a number",
    });
  });

  test("accepts optional fields", () => {
    expect(
      validateCreateIssueForm({
        title: "Ship board",
        description: "  details  ",
        priorityInput: "2",
      }),
    ).toEqual({
      valid: true,
      value: {
        title: "Ship board",
        description: "details",
        priority: 2,
      },
    });
  });
});

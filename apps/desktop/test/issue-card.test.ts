import { describe, expect, test } from "vitest";
import { formatIssuePriority } from "@/renderer/components/issue-card";

describe("issue card", () => {
  test("formatIssuePriority returns null for unset priority", () => {
    expect(formatIssuePriority(null)).toBeNull();
  });

  test("formatIssuePriority renders badge label", () => {
    expect(formatIssuePriority(1)).toBe("P1");
    expect(formatIssuePriority(0)).toBe("P0");
  });
});

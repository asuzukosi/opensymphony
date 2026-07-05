import { describe, expect, test } from "vitest";
import {
  doneWorkflowStateId,
  isHumanReviewState,
  resolveIssueReviewStatus,
} from "@/lib/issue-review-status";

describe("issue review status", () => {
  test("resolves review status from run outcome and workflow category", () => {
    expect(resolveIssueReviewStatus("succeeded", "terminal")).toBe("approved");
    expect(resolveIssueReviewStatus("succeeded", "active")).toBe("pending_review");
    expect(resolveIssueReviewStatus("succeeded", "backlog")).toBe("pending_review");
    expect(resolveIssueReviewStatus("failed", "terminal")).toBeNull();
    expect(resolveIssueReviewStatus("cancelled", "active")).toBeNull();
  });

  test("detects human review workflow state", () => {
    expect(isHumanReviewState("symphony-local:human_review")).toBe(true);
    expect(isHumanReviewState("symphony-local:done")).toBe(false);
  });

  test("builds done workflow state id", () => {
    expect(doneWorkflowStateId("symphony-local")).toBe("symphony-local:done");
  });
});

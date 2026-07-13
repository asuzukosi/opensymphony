"use client";

import { useIssueSheetParams } from "@/lib/issue-sheet-params";
import { cn } from "@/lib/utils";

type IssueLinkProps = {
  issueId: string;
  label: string;
  muted?: boolean;
  className?: string;
};

export function IssueLink({ issueId, label, muted = false, className }: IssueLinkProps) {
  const { openIssueSheet } = useIssueSheetParams();

  return (
    <button
      type="button"
      onClick={() => {
        openIssueSheet(issueId);
      }}
      className={cn(
        muted
          ? "text-muted-foreground hover:text-foreground hover:underline"
          : "font-medium text-foreground hover:underline",
        className,
      )}
    >
      {label}
    </button>
  );
}

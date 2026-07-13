"use client";

import { PlatformAvatar } from "@/components/ui/platform-avatar";
import { useIssueSheetParams } from "@/lib/issue-sheet-params";
import type { PlatformId } from "@/lib/platforms";
import { cn, summarizeText } from "@/lib/utils";

type DashboardIssueCellProps = {
  issueId: string;
  title: string;
  description?: string | null;
  executor?: PlatformId | null;
  className?: string;
};

export function DashboardIssueCell({
  issueId,
  title,
  description,
  executor,
  className,
}: DashboardIssueCellProps) {
  const { openIssueSheet } = useIssueSheetParams();
  const summary = description?.trim() ? summarizeText(description, 64) : null;

  return (
    <button
      type="button"
      onClick={() => openIssueSheet(issueId)}
      className={cn(
        "flex w-full min-w-0 items-start gap-2 rounded-sm text-left transition-colors hover:bg-muted/40",
        className,
      )}
    >
      {executor != null ? (
        <PlatformAvatar platformId={executor} size="sm" tooltip={false} className="mt-0.5 shrink-0" />
      ) : (
        <span className="mt-1 h-5 w-5 shrink-0 rounded-full border border-dashed border-border/80" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium leading-snug text-foreground">
          {title}
        </span>
        {summary ? (
          <span className="mt-0.5 block line-clamp-2 break-words text-[10px] leading-snug text-muted-foreground">
            {summary}
          </span>
        ) : null}
      </span>
    </button>
  );
}

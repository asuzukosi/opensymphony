import React from "react";
import { Link } from "react-router-dom";
import { Badge, cn, type BadgeProps } from "@symphony/ui";
import { surfaceNestedCardClass } from "@/renderer/lib/surface-styles";
import type { RuntimeRecentFinishedEntry } from "@/ipc";

type AgentRecentCardProps = {
  entry: RuntimeRecentFinishedEntry;
};

function formatFinishedAt(finishedAt: string): string {
  const parsed = Date.parse(finishedAt);
  if (Number.isNaN(parsed)) {
    return finishedAt;
  }
  return new Date(parsed).toLocaleString();
}

function statusBadgeVariant(
  status: RuntimeRecentFinishedEntry["status"],
): NonNullable<BadgeProps["variant"]> {
  if (status === "failed") {
    return "destructive";
  }
  if (status === "cancelled") {
    return "outline";
  }
  return "secondary";
}

function reviewStatusLabel(reviewStatus: RuntimeRecentFinishedEntry["reviewStatus"]): string | null {
  if (reviewStatus === "approved") {
    return "Approved";
  }
  if (reviewStatus === "pending_review") {
    return "Pending review";
  }
  return null;
}

function reviewStatusBadgeClassName(
  reviewStatus: NonNullable<RuntimeRecentFinishedEntry["reviewStatus"]>,
): string {
  if (reviewStatus === "approved") {
    return "border-emerald-500/40 text-emerald-700 dark:text-emerald-300";
  }
  return "border-amber-500/40 text-amber-700 dark:text-amber-300";
}

export function AgentRecentCard({ entry }: AgentRecentCardProps): React.JSX.Element {
  const reviewLabel = reviewStatusLabel(entry.reviewStatus);

  return (
    <div className={cn("min-w-0 overflow-hidden rounded-xl border", surfaceNestedCardClass)}>
      <div className="space-y-2 p-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <Link
            to={`/issues/${entry.issueId}`}
            className="min-w-0 truncate font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            {entry.identifier}
          </Link>
          <div className="flex max-w-[55%] shrink-0 flex-wrap items-center justify-end gap-1">
            {reviewLabel && entry.reviewStatus ? (
              <Badge
                variant="outline"
                className={cn("text-[10px] uppercase", reviewStatusBadgeClassName(entry.reviewStatus))}
              >
                {reviewLabel}
              </Badge>
            ) : null}
            <Badge variant={statusBadgeVariant(entry.status)}>{entry.status}</Badge>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">Attempt {entry.attemptNumber}</p>
          <p className="text-muted-foreground">Finished {formatFinishedAt(entry.finishedAt)}</p>
          {entry.errorMessage ? (
            <Badge
              variant="destructive"
              className="max-w-full truncate font-normal"
              title={entry.errorMessage}
            >
              {entry.errorMessage}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

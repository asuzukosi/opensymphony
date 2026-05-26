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

export function AgentRecentCard({ entry }: AgentRecentCardProps): React.JSX.Element {
  return (
    <div className={cn("rounded-xl border", surfaceNestedCardClass)}>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/issues/${entry.issueId}`}
            className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            {entry.identifier}
          </Link>
          <Badge variant={statusBadgeVariant(entry.status)}>{entry.status}</Badge>
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

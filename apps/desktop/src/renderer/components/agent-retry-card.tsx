import React from "react";
import { Link } from "react-router-dom";
import { Badge, cn } from "@symphony/ui";
import { surfaceNestedCardClass } from "@/renderer/lib/surface-styles";
import type { RuntimeRetryEntry } from "@/ipc";

type AgentRetryCardProps = {
  entry: RuntimeRetryEntry;
};

function formatDueAt(dueAt: string): string {
  const parsed = Date.parse(dueAt);
  if (Number.isNaN(parsed)) {
    return dueAt;
  }
  return new Date(parsed).toLocaleString();
}

export function AgentRetryCard({ entry }: AgentRetryCardProps): React.JSX.Element {
  return (
    <div className={cn("rounded-xl border", surfaceNestedCardClass)}>
      <div className="space-y-2 p-3">
        <Link
          to={`/issues/${entry.issueId}`}
          className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
        >
          {entry.identifier}
        </Link>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">Attempt {entry.attemptNumber}</p>
          <p className="text-muted-foreground">Due {formatDueAt(entry.dueAt)}</p>
          {entry.errorMessage ? (
            <Badge
              variant="destructive"
              className="max-w-full truncate font-normal"
              title={entry.errorMessage}
            >
              {entry.errorMessage}
            </Badge>
          ) : (
            <p className="text-xs text-muted-foreground">No error recorded</p>
          )}
        </div>
      </div>
    </div>
  );
}

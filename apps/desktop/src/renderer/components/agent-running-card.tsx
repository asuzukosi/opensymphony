import React from "react";
import { Link } from "react-router-dom";
import { Badge, cn } from "@symphony/ui";
import { surfaceNestedCardClass } from "@/renderer/lib/surface-styles";
import type { RuntimeRunningEntry } from "@/ipc";

type AgentRunningCardProps = {
  entry: RuntimeRunningEntry;
};

function formatRuntimeKind(kind: string | null): string {
  if (kind === "mock-acp") {
    return "Mock";
  }
  if (kind === "acp-cli") {
    return "CLI";
  }
  return kind ?? "Unknown";
}

function formatStartedAt(startedAt: string): string {
  const parsed = Date.parse(startedAt);
  if (Number.isNaN(parsed)) {
    return startedAt;
  }
  return new Date(parsed).toLocaleString();
}

export function AgentRunningCard({ entry }: AgentRunningCardProps): React.JSX.Element {
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
          <Badge variant="secondary">{entry.sessionStatus ?? "unknown"}</Badge>
        </div>
        <div className="space-y-1 text-sm">
          <p>
            <Link
              to={`/issues/${entry.issueId}`}
              className="font-medium hover:text-primary hover:underline"
            >
              View issue
            </Link>
          </p>
          <p className="text-muted-foreground">Attempt {entry.attemptNumber}</p>
          <p className="text-muted-foreground">Started {formatStartedAt(entry.startedAt)}</p>
          <p className="font-mono text-xs text-muted-foreground">
            Session {entry.sessionId ?? "pending"}
          </p>
          <p className="text-xs text-muted-foreground">{formatRuntimeKind(entry.runtimeKind)}</p>
        </div>
      </div>
    </div>
  );
}

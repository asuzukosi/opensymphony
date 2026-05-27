import React from "react";
import { Link } from "react-router-dom";
import { Badge, cn } from "@symphony/ui";
import { surfaceNestedCardClass } from "@/renderer/lib/surface-styles";
import type { RuntimeRunningEntry } from "@/ipc";
import { formatSessionPhase } from "@/renderer/lib/format-session-phase";

type AgentRunningCardProps = {
  entry: RuntimeRunningEntry;
};

function formatStartedAt(startedAt: string): string {
  const parsed = Date.parse(startedAt);
  if (Number.isNaN(parsed)) {
    return startedAt;
  }
  return new Date(parsed).toLocaleString();
}

function formatLastEventSummary(summary: string): string {
  if (summary === "agent_message_chunk") {
    return "streaming response";
  }
  if (summary === "tool_call") {
    return "tool call";
  }
  return summary.replace(/_/g, " ");
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
          <div className="flex flex-wrap items-center justify-end gap-1">
            {entry.phase ? (
              <Badge variant="outline" className="font-normal capitalize">
                {formatSessionPhase(entry.phase)}
              </Badge>
            ) : null}
            <Badge variant="secondary">{entry.sessionStatus ?? "unknown"}</Badge>
          </div>
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
          {entry.lastEventSummary ? (
            <p className="text-xs text-muted-foreground">
              Last event: {formatLastEventSummary(entry.lastEventSummary)}
            </p>
          ) : null}
          <p className="font-mono text-xs text-muted-foreground">
            Session {entry.sessionId ?? "pending"}
          </p>
        </div>
      </div>
    </div>
  );
}

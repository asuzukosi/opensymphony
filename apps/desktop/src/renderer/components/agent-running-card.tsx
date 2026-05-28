import React from "react";
import { Link } from "react-router-dom";
import { Badge, cn } from "@symphony/ui";
import { surfaceNestedCardClass } from "@/renderer/lib/surface-styles";
import type { RuntimeRunningEntry } from "@/ipc";
import { formatSessionPhase } from "@/renderer/lib/format-session-phase";
import { AgentRunControls } from "@/renderer/components/agent-run-controls";

type AgentRunningCardProps = {
  entry: RuntimeRunningEntry;
  disabled?: boolean;
  onPause?: (runAttemptId: string) => Promise<void>;
  onResume?: (runAttemptId: string) => Promise<void>;
  onCancel?: (runAttemptId: string) => Promise<void>;
};

function formatStartedAt(startedAt: string): string {
  const parsed = Date.parse(startedAt);
  if (Number.isNaN(parsed)) {
    return startedAt;
  }
  return new Date(parsed).toLocaleString();
}

function formatLastEventSummary(summary: string): string {
  if (summary === "agent_message_chunk" || summary === "agent_message") {
    return "streaming response";
  }
  if (summary === "agent_thought_chunk" || summary === "agent_thought") {
    return "thinking";
  }
  if (summary === "tool_call") {
    return "tool call";
  }
  if (summary === "tool_call_update") {
    return "tool completed";
  }
  return summary.replace(/_/g, " ");
}

export function AgentRunningCard({
  entry,
  disabled = false,
  onPause,
  onResume,
  onCancel,
}: AgentRunningCardProps): React.JSX.Element {
  const canControlRun = Boolean(onPause && onResume && onCancel);

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
            {entry.paused ? (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                Paused
              </Badge>
            ) : null}
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
          {canControlRun && onPause && onResume && onCancel ? (
            <AgentRunControls
              runAttemptId={entry.runAttemptId}
              paused={entry.paused}
              disabled={disabled}
              onPause={onPause}
              onResume={onResume}
              onCancel={onCancel}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

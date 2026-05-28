import React from "react";
import { cn } from "@symphony/ui";
import { AgentRecentCard } from "@/renderer/components/agent-recent-card";
import { surfaceNestedCardClass } from "@/renderer/lib/surface-styles";
import { AgentRetryCard } from "@/renderer/components/agent-retry-card";
import { AgentRunningCard } from "@/renderer/components/agent-running-card";
import { AgentsColumn } from "@/renderer/components/agents-column";
import { ColumnTrack, ColumnsScroller } from "@/renderer/layout/columns-scroller";
import type {
  RuntimeCandidateEntry,
  RuntimeRecentFinishedEntry,
  RuntimeRetryEntry,
  RuntimeRunningEntry,
} from "@/ipc";

type AgentsColumnsProps = {
  candidates: RuntimeCandidateEntry[];
  running: RuntimeRunningEntry[];
  retrying: RuntimeRetryEntry[];
  recentFinished: RuntimeRecentFinishedEntry[];
  runControlsDisabled?: boolean;
  onPauseRun?: (runAttemptId: string) => Promise<void>;
  onResumeRun?: (runAttemptId: string) => Promise<void>;
  onCancelRun?: (runAttemptId: string) => Promise<void>;
};

function AgentsColumnItem({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={cn("rounded-xl border p-3 text-sm", surfaceNestedCardClass)}>{children}</div>
  );
}

export function AgentsColumns({
  candidates,
  running,
  retrying,
  recentFinished,
  runControlsDisabled = false,
  onPauseRun,
  onResumeRun,
  onCancelRun,
}: AgentsColumnsProps): React.JSX.Element {
  return (
    <ColumnsScroller>
      <ColumnTrack>
        <AgentsColumn
          title="Candidates"
          description={`${candidates.length} eligible for dispatch`}
          count={candidates.length}
          emptyMessage="No issues are waiting for dispatch."
        >
          {candidates.map((entry) => (
            <AgentsColumnItem key={entry.issueId}>
              <div className="space-y-1">
                <p className="font-mono text-xs text-muted-foreground">{entry.identifier}</p>
                <p className="font-medium leading-snug">{entry.title}</p>
                <p className="text-xs text-muted-foreground">{entry.stateCategory}</p>
              </div>
            </AgentsColumnItem>
          ))}
        </AgentsColumn>
      </ColumnTrack>

      <ColumnTrack>
        <AgentsColumn
          title="Running"
          description={`${running.length} active sessions`}
          count={running.length}
          showActiveIndicator={running.length > 0}
          emptyMessage="No agent sessions are running."
        >
          {running.map((entry) => (
            <AgentRunningCard
              key={entry.runAttemptId}
              entry={entry}
              disabled={runControlsDisabled}
              onPause={onPauseRun}
              onResume={onResumeRun}
              onCancel={onCancelRun}
            />
          ))}
        </AgentsColumn>
      </ColumnTrack>

      <ColumnTrack>
        <AgentsColumn
          title="Retrying"
          description={`${retrying.length} queued retries`}
          count={retrying.length}
          emptyMessage="No issues are waiting to retry."
        >
          {retrying.map((entry) => (
            <AgentRetryCard key={entry.issueId} entry={entry} />
          ))}
        </AgentsColumn>
      </ColumnTrack>

      <ColumnTrack>
        <AgentsColumn
          title="Recent"
          description={`${recentFinished.length} finished attempts`}
          count={recentFinished.length}
          emptyMessage="No recently finished run attempts."
        >
          {recentFinished.map((entry) => (
            <AgentRecentCard key={entry.runAttemptId} entry={entry} />
          ))}
        </AgentsColumn>
      </ColumnTrack>
    </ColumnsScroller>
  );
}

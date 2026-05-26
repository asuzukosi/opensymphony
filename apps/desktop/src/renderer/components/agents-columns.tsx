import React from "react";
import { cn } from "@symphony/ui";
import { AgentRecentCard } from "@/renderer/components/agent-recent-card";
import { surfaceNestedCardClass } from "@/renderer/lib/surface-styles";
import { AgentRetryCard } from "@/renderer/components/agent-retry-card";
import { AgentRunningCard } from "@/renderer/components/agent-running-card";
import { AgentsColumn } from "@/renderer/components/agents-column";
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
}: AgentsColumnsProps): React.JSX.Element {
  return (
    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <AgentsColumn
        title="Running"
        description={`${running.length} active sessions`}
        count={running.length}
        emptyMessage="No agent sessions are running."
      >
        {running.map((entry) => (
          <AgentRunningCard key={entry.runAttemptId} entry={entry} />
        ))}
      </AgentsColumn>

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
    </div>
  );
}

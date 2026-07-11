"use client";

import { ClockIcon } from "@/components/ui/hero-icons";
import { EmptyState } from "@/components/layout/empty-state";
import { IssueLink } from "@/components/layout/issue-link";
import { PanelSection } from "@/components/layout/panel-section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/datetime";
import { isPendingLoad } from "@/lib/is-pending-load";
import type { RuntimeAuditEvent } from "@/lib/ipc/types";

export function AuditPanel({ recentEvents, isLoading = false }: { recentEvents?: RuntimeAuditEvent[]; isLoading?: boolean }) {
  const pending = isPendingLoad(isLoading, recentEvents);

  return (
    <PanelSection title="Audit feed" description="Recent orchestration actions for the active project.">
      {pending ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-full" />
            </li>
          ))}
        </ul>
      ) : recentEvents && recentEvents.length > 0 ? (
        <ul className="space-y-2">
          {recentEvents.map((event, index) => (
            <li
              key={`${event.createdAt}-${event.action}-${index}`}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
            >
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {formatDateTime(event.createdAt)}
              </span>
              <span className="min-w-0 text-foreground">
                {event.action}
                {event.issueId ? (
                  <>
                    {" · "}
                    <IssueLink issueId={event.issueId} label={event.issueId} muted />
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={ClockIcon}
          title="No recent orchestration events"
          description="Runtime audit events will appear here as the orchestrator acts on issues."
        />
      )}
    </PanelSection>
  );
}

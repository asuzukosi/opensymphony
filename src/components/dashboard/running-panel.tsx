"use client";

import { PlayCircle } from "lucide-react";

import { BorderedTable, tableHeadClass, tableHeaderRowClass } from "@/components/dashboard/shared";
import { EmptyState } from "@/components/layout/empty-state";
import { IssueLink } from "@/components/layout/issue-link";
import { PanelSection } from "@/components/layout/panel-section";
import { TableSkeleton } from "@/components/layout/table-skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format-date-time";
import { isPendingLoad } from "@/lib/is-pending-load";
import type { RuntimeRunningEntry } from "@/lib/ipc/types";
import { capitalize } from "@/lib/utils";

export function RunningPanel({ running, isLoading = false }: { running?: RuntimeRunningEntry[]; isLoading?: boolean }) {
  const pending = isPendingLoad(isLoading, running);

  return (
    <PanelSection title="Running sessions" description="Live run attempts with attached agent sessions.">
      {pending ? (
        <TableSkeleton columns={5} />
      ) : running && running.length > 0 ? (
        <BorderedTable>
          <Table>
            <TableHeader>
              <TableRow className={tableHeaderRowClass}>
                <TableHead className={tableHeadClass}>Issue</TableHead>
                <TableHead className={tableHeadClass}>Attempt</TableHead>
                <TableHead className={tableHeadClass}>Started</TableHead>
                <TableHead className={tableHeadClass}>Phase</TableHead>
                <TableHead className={tableHeadClass}>Paused</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {running.map((entry) => (
                <TableRow key={entry.runAttemptId} className="hover:bg-muted/20">
                  <TableCell>
                    <IssueLink issueId={entry.issueId} label={entry.identifier} />
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{entry.attemptNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(entry.startedAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {entry.phase ? capitalize(entry.phase) : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.paused ? "secondary" : "outline"} className="font-normal">
                      {entry.paused ? "Paused" : "Active"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </BorderedTable>
      ) : (
        <EmptyState
          icon={PlayCircle}
          title="No running sessions"
          description="Active agent sessions will appear here when the orchestrator dispatches work."
        />
      )}
    </PanelSection>
  );
}

"use client";

import { PlayCircleIcon } from "@/components/ui/hero-icons";
import { BorderedTable, tableHeadClass, tableHeaderRowClass } from "@/components/dashboard/shared";
import { EmptyState } from "@/components/layout/empty-state";
import { IssueLink } from "@/components/layout/issue-link";
import { PanelSection } from "@/components/layout/panel-section";
import { TableSkeleton } from "@/components/layout/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/datetime";
import { isPendingLoad } from "@/lib/is-pending-load";
import type { RuntimeRunningEntry } from "@/lib/ipc/types";
import { capitalize } from "@/lib/utils";

type RunningPanelProps = {
  running?: RuntimeRunningEntry[];
  isLoading?: boolean;
  onPauseRun?: (runAttemptId: string) => Promise<void>;
  onResumeRun?: (runAttemptId: string) => Promise<void>;
  onCancelRun?: (runAttemptId: string) => Promise<void>;
  isControlling?: boolean;
};

export function RunningPanel({
  running,
  isLoading = false,
  onPauseRun,
  onResumeRun,
  onCancelRun,
  isControlling = false,
}: RunningPanelProps) {
  const pending = isPendingLoad(isLoading, running);
  const controlsEnabled = onPauseRun != null && onResumeRun != null && onCancelRun != null;

  return (
    <PanelSection title="Running sessions" description="Live run attempts with attached agent sessions.">
      {pending ? (
        <TableSkeleton columns={controlsEnabled ? 6 : 5} />
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
                {controlsEnabled ? <TableHead className={tableHeadClass}>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {running.map((entry) => (
                <TableRow key={entry.runAttemptId} className="hover:bg-muted/20">
                    <TableCell>
                      <IssueLink issueId={entry.issueId} label={entry.identifier} />
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">{entry.attemptNumber}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(entry.startedAt)}
                    </TableCell>
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
                    {controlsEnabled ? (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {entry.paused ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isControlling}
                              onClick={() => void onResumeRun(entry.runAttemptId)}
                            >
                              {isControlling ? "..." : "Resume"}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isControlling}
                              onClick={() => void onPauseRun(entry.runAttemptId)}
                            >
                              {isControlling ? "..." : "Pause"}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isControlling}
                            onClick={() => void onCancelRun(entry.runAttemptId)}
                          >
                            {isControlling ? "..." : "Cancel"}
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        </BorderedTable>
      ) : (
        <EmptyState
          icon={PlayCircleIcon}
          title="No running sessions"
          description="Active agent sessions will appear here when the orchestrator dispatches work."
        />
      )}
    </PanelSection>
  );
}

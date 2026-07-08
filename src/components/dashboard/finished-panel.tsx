"use client";

import { CheckCircle2 } from "lucide-react";

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
import type { RunAttemptStatus, RuntimeRecentFinishedEntry } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

function attemptStatusVariant(status: RunAttemptStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "failed") return "destructive";
  if (status === "cancelled") return "outline";
  return "secondary";
}

export function FinishedPanel({
  recentFinished,
  isLoading = false,
}: {
  recentFinished?: RuntimeRecentFinishedEntry[];
  isLoading?: boolean;
}) {
  const pending = isPendingLoad(isLoading, recentFinished);

  return (
    <PanelSection title="Recently finished" description="Latest completed run attempts for the active project.">
      {pending ? (
        <TableSkeleton columns={6} />
      ) : recentFinished && recentFinished.length > 0 ? (
        <BorderedTable>
          <Table>
            <TableHeader>
              <TableRow className={tableHeaderRowClass}>
                <TableHead className={tableHeadClass}>Issue</TableHead>
                <TableHead className={tableHeadClass}>Attempt</TableHead>
                <TableHead className={tableHeadClass}>Status</TableHead>
                <TableHead className={tableHeadClass}>Finished</TableHead>
                <TableHead className={tableHeadClass}>Review</TableHead>
                <TableHead className={tableHeadClass}>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentFinished.map((entry) => (
                <TableRow key={entry.runAttemptId} className="hover:bg-muted/20">
                  <TableCell>
                    <IssueLink issueId={entry.issueId} label={entry.identifier} />
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{entry.attemptNumber}</TableCell>
                  <TableCell>
                    <Badge variant={attemptStatusVariant(entry.status)} className="font-normal capitalize">
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(entry.finishedAt)}</TableCell>
                  <TableCell>
                    {entry.reviewStatus ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          entry.reviewStatus === "approved"
                            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/40 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {entry.reviewStatus === "approved" ? "Approved" : "Pending review"}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    {entry.errorMessage ? (
                      <Badge variant="destructive" className="max-w-full truncate font-normal" title={entry.errorMessage}>
                        {entry.errorMessage}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </BorderedTable>
      ) : (
        <EmptyState
          icon={CheckCircle2}
          title="No recently finished runs"
          description="Completed run attempts will appear here after agents finish work."
        />
      )}
    </PanelSection>
  );
}

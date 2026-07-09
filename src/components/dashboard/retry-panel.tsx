"use client";

import { ArrowPathIcon } from "@/components/dashboard/dashboard-icons";
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
import type { RuntimeRetryEntry } from "@/lib/ipc/types";

export function RetryPanel({ retrying, isLoading = false }: { retrying?: RuntimeRetryEntry[]; isLoading?: boolean }) {
  const pending = isPendingLoad(isLoading, retrying);

  return (
    <PanelSection title="Retry queue" description="Issues waiting to be retried after a failed run attempt.">
      {pending ? (
        <TableSkeleton columns={4} />
      ) : retrying && retrying.length > 0 ? (
        <BorderedTable>
          <Table>
            <TableHeader>
              <TableRow className={tableHeaderRowClass}>
                <TableHead className={tableHeadClass}>Issue</TableHead>
                <TableHead className={tableHeadClass}>Attempt</TableHead>
                <TableHead className={tableHeadClass}>Due</TableHead>
                <TableHead className={tableHeadClass}>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {retrying.map((entry) => (
                <TableRow key={`${entry.issueId}-${entry.attemptNumber}`} className="hover:bg-muted/20">
                  <TableCell>
                    <IssueLink issueId={entry.issueId} label={entry.identifier} />
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{entry.attemptNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(entry.dueAt)}</TableCell>
                  <TableCell className="max-w-[320px]">
                    {entry.errorMessage ? (
                      <Badge variant="destructive" className="max-w-full truncate font-normal" title={entry.errorMessage}>
                        {entry.errorMessage}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">No error recorded</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </BorderedTable>
      ) : (
        <EmptyState
          icon={ArrowPathIcon}
          title="No retry queue entries"
          description="Failed run attempts scheduled for retry will appear here."
        />
      )}
    </PanelSection>
  );
}

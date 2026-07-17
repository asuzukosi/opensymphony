"use client";

import { ArrowPathIcon } from "@/components/ui/hero-icons";
import { DashboardTaskCell } from "@/components/dashboard/dashboard-task-cell";
import {
  BorderedTable,
  tableCellClass,
  tableHeadClass,
  tableHeaderRowClass,
  tableMutedTextClass,
} from "@/components/dashboard/shared";
import { EmptyState } from "@/components/layout/empty-state";
import { PanelSection } from "@/components/layout/panel-section";
import { TableSkeleton } from "@/components/layout/table-skeleton";
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
import type { RuntimeRetryEntry } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

export function RetryPanel({ retrying, isLoading = false }: { retrying?: RuntimeRetryEntry[]; isLoading?: boolean }) {
  const pending = isPendingLoad(isLoading, retrying);

  return (
    <PanelSection title="Retry queue" description="Tasks waiting to be retried after a failed run attempt.">
      {pending ? (
        <TableSkeleton columns={4} />
      ) : retrying && retrying.length > 0 ? (
        <BorderedTable>
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className={tableHeaderRowClass}>
                <TableHead className={cn(tableHeadClass, "w-[42%]")}>Task</TableHead>
                <TableHead className={cn(tableHeadClass, "w-10")}>*</TableHead>
                <TableHead className={cn(tableHeadClass, "w-28 whitespace-nowrap")}>Due</TableHead>
                <TableHead className={tableHeadClass}>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {retrying.map((entry) => (
                <TableRow key={`${entry.taskId}-${entry.attemptNumber}`} className="hover:bg-muted/20">
                  <TableCell className={cn(tableCellClass, "max-w-0")}>
                    <DashboardTaskCell
                      taskId={entry.taskId}
                      title={entry.title}
                      description={entry.description}
                      executor={entry.executor}
                    />
                  </TableCell>
                  <TableCell className={cn(tableCellClass, tableMutedTextClass, "tabular-nums")}>
                    {entry.attemptNumber}
                  </TableCell>
                  <TableCell className={cn(tableCellClass, tableMutedTextClass)}>
                    {formatDateTime(entry.dueAt)}
                  </TableCell>
                  <TableCell className={cn(tableCellClass, "max-w-0")}>
                    {entry.errorMessage ? (
                      <span
                        className="block truncate text-[10px] leading-snug text-destructive"
                        title={entry.errorMessage}
                      >
                        {entry.errorMessage}
                      </span>
                    ) : (
                      <span className={tableMutedTextClass}>No error recorded</span>
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

"use client";

import { CheckCircleIcon } from "@/components/ui/hero-icons";
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
import { Badge } from "@/components/ui/badge";
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
import type { RunAttemptStatus, RuntimeRecentFinishedEntry } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

function attemptStatusVariant(
  status: RunAttemptStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "failed") return "destructive";
  if (status === "cancelled") return "outline";
  return "secondary";
}

const compactBadgeClass =
  "h-4 min-h-0 rounded px-1 py-0 text-[9px] font-normal leading-none shadow-none";

export function FinishedPanel({
  recentFinished,
  isLoading = false,
}: {
  recentFinished?: RuntimeRecentFinishedEntry[];
  isLoading?: boolean;
}) {
  const pending = isPendingLoad(isLoading, recentFinished);

  return (
    <PanelSection
      compact
      title="Recently finished"
      description="Latest completed runs with task context for the active project."
    >
      {pending ? (
        <TableSkeleton columns={6} rows={4} />
      ) : recentFinished && recentFinished.length > 0 ? (
        <BorderedTable>
          <Table>
            <TableHeader>
              <TableRow className={tableHeaderRowClass}>
                <TableHead className={cn(tableHeadClass, "w-[36%] min-w-[220px]")}>Task</TableHead>
                <TableHead className={cn(tableHeadClass, "w-10")}>#</TableHead>
                <TableHead className={cn(tableHeadClass, "w-16 whitespace-nowrap")}>Status</TableHead>
                <TableHead className={cn(tableHeadClass, "w-36 whitespace-nowrap")}>Finished</TableHead>
                <TableHead className={cn(tableHeadClass, "w-20 whitespace-nowrap")}>Review</TableHead>
                <TableHead className={cn(tableHeadClass, "min-w-[160px]")}>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentFinished.map((entry) => (
                <TableRow key={entry.runAttemptId} className="hover:bg-muted/20">
                  <TableCell className={cn(tableCellClass, "min-w-[220px]")}>
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
                  <TableCell className={tableCellClass}>
                    <Badge
                      variant={attemptStatusVariant(entry.status)}
                      className={cn(compactBadgeClass, "capitalize")}
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn(tableCellClass, tableMutedTextClass)}>
                    {formatDateTime(entry.finishedAt)}
                  </TableCell>
                  <TableCell className={tableCellClass}>
                    {entry.reviewStatus ? (
                      <Badge
                        variant={entry.reviewStatus === "approved" ? "success" : "warning"}
                        className={compactBadgeClass}
                      >
                        {entry.reviewStatus === "approved" ? "Approved" : "Pending"}
                      </Badge>
                    ) : (
                      <span className={tableMutedTextClass}>—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(tableCellClass, "min-w-[160px]")}>
                    {entry.errorMessage ? (
                      <span
                        className="block truncate text-[10px] leading-snug text-destructive"
                        title={entry.errorMessage}
                      >
                        {entry.errorMessage}
                      </span>
                    ) : (
                      <span className={tableMutedTextClass}>—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </BorderedTable>
      ) : (
        <EmptyState
          icon={CheckCircleIcon}
          title="No recently finished runs"
          description="Completed run attempts will appear here after agents finish work."
        />
      )}
    </PanelSection>
  );
}

"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo } from "react";

import { DashboardTaskCell } from "@/components/dashboard/dashboard-task-cell";
import { EmptyState } from "@/components/layout/empty-state";
import { PanelSection } from "@/components/layout/panel-section";
import { DataGrid, DataGridContainer } from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon } from "@/components/ui/hero-icons";
import { formatDateTime } from "@/lib/datetime";
import type { RunAttemptStatus, RuntimeRecentFinishedEntry } from "@/lib/ipc/types";
import { isPendingLoad } from "@/lib/is-pending-load";

function attemptStatusVariant(status: RunAttemptStatus): "secondary" | "destructive" | "outline" {
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
  const rows = recentFinished ?? [];

  const columns = useMemo<ColumnDef<RuntimeRecentFinishedEntry>[]>(
    () => [
      {
        id: "task",
        header: "Task",
        cell: ({ row }) => (
          <DashboardTaskCell
            taskId={row.original.taskId}
            title={row.original.title}
            description={row.original.description}
            executor={row.original.executor}
          />
        ),
        size: 260,
      },
      {
        accessorKey: "attemptNumber",
        header: "#",
        cell: ({ row }) => (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {row.original.attemptNumber}
          </span>
        ),
        size: 40,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={attemptStatusVariant(row.original.status)}
            size="xs"
            radius="full"
            className="font-normal capitalize"
          >
            {row.original.status}
          </Badge>
        ),
        size: 88,
      },
      {
        accessorKey: "finishedAt",
        header: "Finished",
        cell: ({ row }) => (
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.finishedAt)}
          </span>
        ),
        size: 128,
      },
      {
        accessorKey: "reviewStatus",
        header: "Review",
        cell: ({ row }) =>
          row.original.reviewStatus ? (
            <Badge
              variant={row.original.reviewStatus === "approved" ? "success-light" : "warning-light"}
              size="xs"
              radius="full"
              className="font-normal"
            >
              {row.original.reviewStatus === "approved" ? "Approved" : "Pending"}
            </Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          ),
        size: 88,
      },
      {
        accessorKey: "errorMessage",
        header: "Error",
        cell: ({ row }) =>
          row.original.errorMessage ? (
            <span
              className="block truncate text-[10px] leading-snug text-destructive"
              title={row.original.errorMessage}
            >
              {row.original.errorMessage}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          ),
        size: 160,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.runAttemptId,
  });

  return (
    <PanelSection
      compact
      title="Recently finished"
      description="Latest completed runs with task context for the active project."
    >
      {pending || rows.length > 0 ? (
        <DataGrid
          table={table}
          recordCount={rows.length}
          isLoading={pending}
          tableLayout={{ dense: true, width: "fixed" }}
        >
          <DataGridContainer>
            <DataGridTable />
          </DataGridContainer>
        </DataGrid>
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

"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo } from "react";

import { DashboardTaskCell } from "@/components/dashboard/dashboard-task-cell";
import { EmptyState } from "@/components/layout/empty-state";
import { PanelSection } from "@/components/layout/panel-section";
import { DataGrid, DataGridContainer } from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { ArrowPathIcon } from "@/components/ui/hero-icons";
import { formatDateTime } from "@/lib/datetime";
import type { RuntimeRetryEntry } from "@/lib/ipc/types";
import { isPendingLoad } from "@/lib/is-pending-load";

export function RetryPanel({
  retrying,
  isLoading = false,
}: {
  retrying?: RuntimeRetryEntry[];
  isLoading?: boolean;
}) {
  const pending = isPendingLoad(isLoading, retrying);
  const rows = retrying ?? [];

  const columns = useMemo<ColumnDef<RuntimeRetryEntry>[]>(
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
        size: 280,
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
        accessorKey: "dueAt",
        header: "Due",
        cell: ({ row }) => (
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.dueAt)}
          </span>
        ),
        size: 112,
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
            <span className="text-[10px] text-muted-foreground">No error recorded</span>
          ),
        size: 200,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => `${row.taskId}-${row.attemptNumber}`,
  });

  return (
    <PanelSection
      title="Retry queue"
      description="Tasks waiting to be retried after a failed run attempt."
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
          icon={ArrowPathIcon}
          title="No retry queue entries"
          description="Failed run attempts scheduled for retry will appear here."
        />
      )}
    </PanelSection>
  );
}

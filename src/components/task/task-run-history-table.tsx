"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { VariantProps } from "class-variance-authority";
import { useMemo } from "react";

import { DataGrid, DataGridContainer } from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { TaskDetailSection } from "@/components/task/task-detail-section";
import { TaskSessionTimeline } from "@/components/task/task-session-timeline";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";
import type { SessionEvent, TaskDetailRunAttempt } from "@/lib/ipc/types";
import { cn, wrapText, wrapTextPreserve } from "@/lib/utils";

type TaskRunHistoryTableProps = {
  attempts?: TaskDetailRunAttempt[];
  sessionEvents?: SessionEvent[];
  isLoading?: boolean;
};

function formatTimestamp(value: string | null): string {
  return formatDateTime(value, "Running");
}

function statusBadgeVariant(
  status: string,
): NonNullable<VariantProps<typeof badgeVariants>["variant"]> {
  if (status === "succeeded") {
    return "success-light";
  }
  if (status === "failed") {
    return "destructive";
  }
  if (status === "cancelled" || status === "canceled") {
    return "outline";
  }
  return "secondary";
}

export function TaskRunHistoryTable({
  attempts,
  sessionEvents = [],
  isLoading = false,
}: TaskRunHistoryTableProps) {
  const rows = attempts ?? [];

  const columns = useMemo<ColumnDef<TaskDetailRunAttempt>[]>(
    () => [
      {
        accessorKey: "attemptNumber",
        header: "Attempt",
        cell: ({ row }) => (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            #{row.original.attemptNumber}
          </span>
        ),
        size: 72,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={statusBadgeVariant(row.original.status)}
            size="xs"
            radius="full"
            className="font-normal capitalize"
          >
            {row.original.status}
          </Badge>
        ),
        size: 96,
      },
      {
        accessorKey: "startedAt",
        header: "Started",
        cell: ({ row }) => (
          <span className={cn("text-[10px] leading-tight text-muted-foreground", wrapText)}>
            {formatTimestamp(row.original.startedAt)}
          </span>
        ),
      },
      {
        accessorKey: "finishedAt",
        header: "Finished",
        cell: ({ row }) => (
          <span className={cn("text-[10px] leading-tight text-muted-foreground", wrapText)}>
            {formatTimestamp(row.original.finishedAt)}
          </span>
        ),
      },
      {
        accessorKey: "errorMessage",
        header: "Details",
        cell: ({ row }) =>
          row.original.errorMessage ? (
            <p className={cn("text-xs text-destructive", wrapTextPreserve)}>
              {row.original.errorMessage}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
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
    <div className="min-w-0 space-y-8">
      <TaskDetailSection title="Run history" description="Run attempts for this task.">
        {isLoading || rows.length > 0 ? (
          <DataGrid
            table={table}
            recordCount={rows.length}
            isLoading={isLoading}
            tableLayout={{ dense: true, width: "fixed" }}
            emptyMessage={
              <p className="text-xs text-muted-foreground">
                Run attempts will appear here after the orchestrator dispatches this task.
              </p>
            }
          >
            <DataGridContainer border={false}>
              <DataGridTable />
            </DataGridContainer>
          </DataGrid>
        ) : (
          <p className="text-xs text-muted-foreground">
            Run attempts will appear here after the orchestrator dispatches this task.
          </p>
        )}
      </TaskDetailSection>

      <TaskDetailSection
        title="Session timeline"
        description="Prompt, tool, permission, and error events from agent runs."
      >
        <TaskSessionTimeline
          events={sessionEvents}
          isLoading={isLoading}
          emptyMessage="Session events will appear here after an agent run records activity."
        />
      </TaskDetailSection>
    </div>
  );
}

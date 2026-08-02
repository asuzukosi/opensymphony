"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo } from "react";

import { DashboardTaskCell } from "@/components/dashboard/dashboard-task-cell";
import { EmptyState } from "@/components/layout/empty-state";
import { PanelSection } from "@/components/layout/panel-section";
import { DataGrid, DataGridContainer } from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayCircleIcon } from "@/components/ui/hero-icons";
import { formatDateTime } from "@/lib/datetime";
import type { RuntimeRunningEntry } from "@/lib/ipc/types";
import { isPendingLoad } from "@/lib/is-pending-load";
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
  const rows = running ?? [];

  const columns = useMemo<ColumnDef<RuntimeRunningEntry>[]>(() => {
    const base: ColumnDef<RuntimeRunningEntry>[] = [
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
        accessorKey: "startedAt",
        header: "Started",
        cell: ({ row }) => (
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.startedAt)}
          </span>
        ),
        size: 112,
      },
      {
        accessorKey: "phase",
        header: "Phase",
        cell: ({ row }) => (
          <Badge variant="outline" size="xs" radius="full" className="font-normal">
            {row.original.phase ? capitalize(row.original.phase) : "—"}
          </Badge>
        ),
        size: 96,
      },
      {
        accessorKey: "paused",
        header: "Paused",
        cell: ({ row }) => (
          <Badge
            variant={row.original.paused ? "secondary" : "outline"}
            size="xs"
            radius="full"
            className="font-normal"
          >
            {row.original.paused ? "Paused" : "Active"}
          </Badge>
        ),
        size: 88,
      },
    ];

    if (!controlsEnabled) {
      return base;
    }

    return [
      ...base,
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.paused ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px]"
                disabled={isControlling}
                onClick={() => void onResumeRun?.(row.original.runAttemptId)}
              >
                {isControlling ? "..." : "Resume"}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px]"
                disabled={isControlling}
                onClick={() => void onPauseRun?.(row.original.runAttemptId)}
              >
                {isControlling ? "..." : "Pause"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-[10px]"
              disabled={isControlling}
              onClick={() => void onCancelRun?.(row.original.runAttemptId)}
            >
              {isControlling ? "..." : "Cancel"}
            </Button>
          </div>
        ),
        size: 160,
      },
    ];
  }, [controlsEnabled, isControlling, onCancelRun, onPauseRun, onResumeRun]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.runAttemptId,
  });

  return (
    <PanelSection
      title="Running sessions"
      description="Live run attempts with attached agent sessions."
    >
      {pending || rows.length > 0 ? (
        <DataGrid
          table={table}
          recordCount={rows.length}
          isLoading={pending}
          tableLayout={{ dense: true, width: "fixed" }}
          emptyMessage={
            <EmptyState
              icon={PlayCircleIcon}
              title="No running sessions"
              description="Active agent sessions will appear here when the orchestrator dispatches work."
              compact
            />
          }
        >
          <DataGridContainer>
            <DataGridTable />
          </DataGridContainer>
        </DataGrid>
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

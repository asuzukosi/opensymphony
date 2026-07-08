"use client";

import { AlertCircle } from "lucide-react";

import { SurfaceCard } from "@/components/layout/surface-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnTrack, ColumnsScroller } from "@/components/layout/columns-scroller";
import { BOARD_COLUMN_IDS, type BoardColumnId } from "@/lib/ipc/types";

export const BOARD_COLUMN_LABELS: Record<BoardColumnId, string> = {
  backlog: "Backlog",
  inProgress: "In progress",
  review: "Review",
  done: "Done",
};

export function BoardColumnCountSkeleton() {
  return <Skeleton className="h-5 w-16" />;
}

export function BoardColumnBodySkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-[4.5rem] w-full rounded-xl" />
      <Skeleton className="h-[4.5rem] w-full rounded-xl" />
      <Skeleton className="h-[4.5rem] w-full rounded-xl" />
    </div>
  );
}

type BoardColumnSkeletonProps = {
  columnId: BoardColumnId;
};

export function BoardColumnSkeleton({ columnId }: BoardColumnSkeletonProps) {
  const label = BOARD_COLUMN_LABELS[columnId];

  return (
    <SurfaceCard className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-2 space-y-0 border-b border-border/60 pb-3">
        <div className="space-y-2">
          <CardTitle className="text-base">{label}</CardTitle>
          <BoardColumnCountSkeleton />
        </div>
        {columnId === "backlog" ? <Skeleton className="size-8 shrink-0 rounded-md" /> : null}
      </CardHeader>
      <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3 pt-3">
        <BoardColumnBodySkeleton />
      </div>
    </SurfaceCard>
  );
}

type BoardColumnsSkeletonProps = {
  className?: string;
};

export function BoardColumnsSkeleton({ className }: BoardColumnsSkeletonProps) {
  return (
    <ColumnsScroller className={className}>
      {BOARD_COLUMN_IDS.map((columnId) => (
        <ColumnTrack key={columnId}>
          <BoardColumnSkeleton columnId={columnId} />
        </ColumnTrack>
      ))}
    </ColumnsScroller>
  );
}

type BoardColumnEmptyStateProps = {
  showCreateHint?: boolean;
};

export function BoardColumnEmptyState({ showCreateHint = false }: BoardColumnEmptyStateProps) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
      <p className="text-sm font-medium text-muted-foreground">No tasks</p>
      {showCreateHint ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Drop a task here or use + to create one
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">Drop a task here to move it</p>
      )}
    </div>
  );
}

type BoardColumnErrorStateProps = {
  error: Error;
};

export function BoardColumnErrorState({ error }: BoardColumnErrorStateProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Column unavailable</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

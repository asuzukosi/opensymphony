"use client";

import { ExclamationCircleIcon } from "@/components/ui/hero-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  return <Skeleton className="h-4 w-20" />;
}

export function BoardColumnBodySkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[7.5rem] w-full rounded-xl" />
      <Skeleton className="h-[7.5rem] w-full rounded-xl" />
      <Skeleton className="h-[7.5rem] w-full rounded-xl" />
    </div>
  );
}

type BoardColumnSkeletonProps = {
  columnId: BoardColumnId;
};

export function BoardColumnSkeleton({ columnId }: BoardColumnSkeletonProps) {
  const label = BOARD_COLUMN_LABELS[columnId];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 space-y-1">
        <p className="text-base font-medium">{label}</p>
        <BoardColumnCountSkeleton />
      </div>
      <div className="min-h-0 flex-1">
        <BoardColumnBodySkeleton />
        {columnId === "backlog" ? (
          <Skeleton className="mt-3 h-9 w-full rounded-md" />
        ) : null}
      </div>
    </div>
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
    <div className="flex min-h-[10rem] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/40 px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">No tasks</p>
      {showCreateHint ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Drop a task here or use Add below
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
      <ExclamationCircleIcon className="h-4 w-4" />
      <AlertTitle>Column unavailable</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

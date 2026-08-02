"use client";

import {
  ArchiveBoxArrowDownIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  ExclamationCircleIcon,
} from "@/components/ui/hero-icons";
import type { ComponentType, SVGProps } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { BoardColumnId } from "@/lib/ipc/types";

export const BOARD_COLUMN_LABELS: Record<BoardColumnId, string> = {
  backlog: "Backlog",
  inProgress: "In progress",
  review: "Review",
  done: "Done",
};

export const BOARD_COLUMN_COUNT_ICONS: Record<
  BoardColumnId,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  backlog: DocumentDuplicateIcon,
  inProgress: DocumentDuplicateIcon,
  review: ClipboardDocumentListIcon,
  done: ClipboardDocumentCheckIcon,
};

export function BoardColumnCountSkeleton() {
  return <Skeleton className="h-5 w-16 rounded-full" />;
}

export function BoardColumnBodySkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-30 w-full rounded-xl" />
      <Skeleton className="h-30 w-full rounded-xl" />
      <Skeleton className="h-30 w-full rounded-xl" />
    </div>
  );
}

type BoardColumnEmptyStateProps = {
  showCreateHint?: boolean;
};

export function BoardColumnEmptyState({ showCreateHint = false }: BoardColumnEmptyStateProps) {
  return (
    <EmptyState
      compact
      icon={ArchiveBoxArrowDownIcon}
      className="min-h-40 rounded-xl border-border/70 bg-card/40"
      title="No tasks"
      description={
        showCreateHint ? "Drop a task here or use Add below" : "Drop a task here to move it"
      }
    />
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

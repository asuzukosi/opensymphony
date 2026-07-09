import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const COLUMN_TRACK_WIDTH_CLASS = "w-board-column shrink-0";

type ColumnsScrollerProps = {
  children: ReactNode;
  className?: string;
};

export function ColumnsScroller({ children, className }: ColumnsScrollerProps) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain",
        className,
      )}
    >
      <div className="flex h-full min-h-[32rem] w-max gap-board-column pb-2">{children}</div>
    </div>
  );
}

type ColumnTrackProps = {
  children: ReactNode;
  className?: string;
};

export function ColumnTrack({ children, className }: ColumnTrackProps) {
  return <div className={cn("flex h-full min-h-0 flex-col", COLUMN_TRACK_WIDTH_CLASS, className)}>{children}</div>;
}

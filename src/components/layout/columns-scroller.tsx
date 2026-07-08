import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const COLUMN_TRACK_WIDTH_CLASS = "w-72 shrink-0";

type ColumnsScrollerProps = {
  children: ReactNode;
  className?: string;
};

export function ColumnsScroller({ children, className }: ColumnsScrollerProps) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-x-auto overflow-y-hidden", className)}>
      <div className="flex h-full min-h-[28rem] w-max min-w-full gap-4 pb-1">{children}</div>
    </div>
  );
}

type ColumnTrackProps = {
  children: ReactNode;
  className?: string;
};

export function ColumnTrack({ children, className }: ColumnTrackProps) {
  return <div className={cn("h-full", COLUMN_TRACK_WIDTH_CLASS, className)}>{children}</div>;
}

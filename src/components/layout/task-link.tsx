"use client";

import { useTaskSheetParams } from "@/lib/task-sheet-params";
import { cn } from "@/lib/utils";

type TaskLinkProps = {
  taskId: string;
  label: string;
  muted?: boolean;
  className?: string;
};

export function TaskLink({ taskId, label, muted = false, className }: TaskLinkProps) {
  const { openTaskSheet } = useTaskSheetParams();

  return (
    <button
      type="button"
      onClick={() => {
        openTaskSheet(taskId);
      }}
      className={cn(
        muted
          ? "text-muted-foreground hover:text-foreground hover:underline"
          : "font-medium text-foreground hover:underline",
        className,
      )}
    >
      {label}
    </button>
  );
}

import type { ReactNode } from "react";

export const tableHeadClass = "h-8 px-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
export const tableHeaderRowClass = "bg-muted/30 hover:bg-muted/30";
export const tableCellClass = "px-3 py-2 align-top";
export const tableMutedTextClass = "text-[10px] text-muted-foreground";
export const tableCompactTextClass = "text-xs";

export function BorderedTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">{children}</div>
  );
}

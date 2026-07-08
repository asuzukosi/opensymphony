import type { ReactNode } from "react";

export const tableHeadClass = "text-xs uppercase tracking-wide";
export const tableHeaderRowClass = "bg-muted/30 hover:bg-muted/30";

export function BorderedTable({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-border/60">{children}</div>;
}

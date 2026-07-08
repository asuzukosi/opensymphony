import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MetadataFieldProps = {
  label: string;
  value: ReactNode;
  className?: string;
};

export function MetadataField({ label, value, className }: MetadataFieldProps) {
  return (
    <div className={cn("space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3", className)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

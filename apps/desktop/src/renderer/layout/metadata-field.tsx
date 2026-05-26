import React from "react";
import { surfacePanelClass } from "@/renderer/lib/surface-styles";
import { cn } from "@symphony/ui";

type MetadataFieldProps = {
  label: string;
  value: React.ReactNode;
  className?: string;
};

export function MetadataField({ label, value, className }: MetadataFieldProps): React.JSX.Element {
  return (
    <div className={cn("space-y-1 p-3", surfacePanelClass, className)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

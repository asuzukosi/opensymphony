import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/layout/surface-card";

type PanelSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
  compact?: boolean;
};

export function PanelSection({ title, description, children, compact = false }: PanelSectionProps) {
  return (
    <SurfaceCard className="min-w-0 space-y-3">
      <div className="space-y-0.5">
        <h3
          className={
            compact
              ? "text-xs font-medium tracking-tight text-foreground"
              : "text-sm font-medium tracking-tight"
          }
        >
          {title}
        </h3>
        <p className={compact ? "text-[10px] text-muted-foreground" : "text-xs text-muted-foreground"}>
          {description}
        </p>
      </div>
      {children}
    </SurfaceCard>
  );
}

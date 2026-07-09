import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/layout/surface-card";

type PanelSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function PanelSection({ title, description, children }: PanelSectionProps) {
  return (
    <SurfaceCard className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-normal tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </SurfaceCard>
  );
}

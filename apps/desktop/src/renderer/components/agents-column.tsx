import React from "react";
import { CardDescription, CardHeader, CardTitle } from "@symphony/ui";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import {
  surfaceColumnBodyClass,
  surfaceColumnScrollClass,
  surfaceColumnShellClass,
} from "@/renderer/lib/surface-styles";

type AgentsColumnProps = {
  title: string;
  description: string;
  count: number;
  emptyMessage: string;
  showActiveIndicator?: boolean;
  children: React.ReactNode;
};

export function AgentsColumn({
  title,
  description,
  count,
  emptyMessage,
  showActiveIndicator = false,
  children,
}: AgentsColumnProps): React.JSX.Element {
  const isEmpty = count === 0;

  return (
    <SurfaceCard className={surfaceColumnShellClass}>
      <CardHeader className="shrink-0 space-y-1 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {showActiveIndicator ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"
              aria-label="active agent sessions"
            />
          ) : null}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <div className={surfaceColumnScrollClass}>
        <div className={surfaceColumnBodyClass}>
          {isEmpty ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            children
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}

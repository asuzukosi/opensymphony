import { BarChart3 } from "lucide-react";
import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/layout/surface-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  data?: unknown[];
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function ChartCard({
  title,
  subtitle,
  emptyMessage = "No data for this period",
  isLoading = false,
  data,
  children,
  actions,
  className,
}: ChartCardProps) {
  const isEmpty = !children && (data === undefined || data.length === 0);

  return (
    <SurfaceCard className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="h-[240px]">
        {isLoading ? (
          <Skeleton className="h-full w-full rounded-lg" />
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 text-center">
            <BarChart3 className="mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </SurfaceCard>
  );
}

import type { LucideIcon } from "lucide-react";

import { SurfaceCard } from "@/components/layout/surface-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: number | string;
  description: string;
  icon?: LucideIcon;
  iconClassName?: string;
  isLoading?: boolean;
  className?: string;
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
  isLoading = false,
  className,
}: StatCardProps) {
  return (
    <SurfaceCard
      className={cn("overflow-hidden transition-colors hover:border-border", className)}
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
          {Icon ? (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/50",
                iconClassName,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
        </div>
      )}
    </SurfaceCard>
  );
}

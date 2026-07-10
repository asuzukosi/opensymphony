import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/layout/surface-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardShellProps = {
  title: string;
  value: ReactNode;
  description: string;
  icon: ReactNode;
  isLoading?: boolean;
  className?: string;
};

export function StatCardShell({
  title,
  value,
  description,
  icon,
  isLoading = false,
  className,
}: StatCardShellProps) {
  return (
    <SurfaceCard
      className={cn("overflow-hidden bg-white transition-colors hover:border-border", className)}
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <p className="text-sm font-normal text-muted-foreground">{title}</p>
            <p className="text-xs font-medium ">{value}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-white text-muted-foreground">
            {icon}
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}

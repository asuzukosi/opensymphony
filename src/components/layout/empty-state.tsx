import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 text-center",
        compact ? "px-4 py-8" : "px-6 py-10",
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "mb-2 flex items-center justify-center rounded-full border border-border/40 bg-background text-muted-foreground",
            compact ? "h-8 w-8" : "mb-3 h-10 w-10",
          )}
        >
          <Icon className={compact ? "size-4" : "h-5 w-5"} />
        </div>
      ) : null}
      <p className={cn(compact ? "text-xs font-medium" : "text-sm font-normal")}>{title}</p>
      {description ? (
        <p
          className={cn(
            "mt-1 max-w-sm text-muted-foreground",
            compact ? "text-[10px] leading-snug" : "text-sm",
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className={cn(compact ? "mt-3" : "mt-4")}>{action}</div> : null}
    </div>
  );
}

import type { ComponentType, ReactNode, SVGProps } from "react";

import { IconTile } from "@/components/ui/icon-tile";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
    <Empty
      className={cn(
        "border border-dashed border-border/70 bg-muted/20",
        compact ? "gap-3 p-4 md:p-6" : "gap-4 p-6 md:p-10",
        className,
      )}
    >
      <EmptyHeader className={cn(compact && "gap-1.5")}>
        {Icon ? (
          <EmptyMedia>
            <IconTile
              variant="frame"
              size={compact ? "sm" : "default"}
              radius="full"
              aria-hidden="true"
            >
              <Icon />
            </IconTile>
          </EmptyMedia>
        ) : null}
        <EmptyTitle className={cn(compact ? "text-xs font-medium" : "text-sm font-normal")}>
          {title}
        </EmptyTitle>
        {description ? (
          <EmptyDescription className={cn(compact ? "text-[10px] leading-snug" : "text-sm")}>
            {description}
          </EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent className={cn(compact && "gap-2")}>{action}</EmptyContent> : null}
    </Empty>
  );
}

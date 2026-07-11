import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-background">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      ) : null}
      <p className="text-sm font-normal">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

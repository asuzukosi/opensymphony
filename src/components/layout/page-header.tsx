import type { ComponentType, ReactNode, SVGProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  actions?: ReactNode;
  isLoading?: boolean;
  className?: string;
};

export function PageHeader({
  eyebrow,
  icon: Icon,
  title,
  description,
  actions,
  isLoading = false,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-1", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {eyebrow}
            </div>
          ) : null}
          {isLoading ? (
            <>
              <Skeleton className="h-8 w-44" />
              {description !== undefined ? <Skeleton className="h-4 w-full max-w-lg" /> : null}
            </>
          ) : (
            <>
              <h1 className="text-base font-medium tracking-tight">{title}</h1>
              {description ? (
                <p className="max-w-lg text-xs text-muted-foreground">{description}</p>
              ) : null}
            </>
          )}
        </div>
        {actions && !isLoading ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

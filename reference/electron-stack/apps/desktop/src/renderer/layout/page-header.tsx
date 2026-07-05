import React from "react";
import { type LucideIcon } from "lucide-react";
import { Skeleton, cn } from "@symphony/ui";
import { surfaceHeroClass } from "@/renderer/lib/surface-styles";

type PageHeaderProps = {
  eyebrow?: string;
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  metaLabel?: string;
  isLoading?: boolean;
  variant?: "hero" | "compact";
  className?: string;
};

export function PageHeader({
  eyebrow,
  icon: Icon,
  title,
  description,
  actions,
  meta,
  metaLabel,
  isLoading = false,
  variant = "hero",
  className,
}: PageHeaderProps): React.JSX.Element {
  const isHero = variant === "hero";

  return (
    <section
      className={cn(
        isHero ? cn(surfaceHeroClass, "p-4 md:p-5") : "space-y-3",
        className,
      )}
    >
      {isHero ? (
        <>
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-chart-1/10 blur-3xl" />
        </>
      ) : null}

      <div
        className={cn(
          "relative flex flex-col gap-4",
          isHero ? "gap-4 md:flex-row md:items-center md:justify-between" : "md:flex-row md:items-start md:justify-between",
        )}
      >
        <div className={cn("space-y-2", !isHero && "space-y-1")}>
          {eyebrow ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              {Icon ? <Icon className="h-3.5 w-3.5 text-chart-1" /> : null}
              {eyebrow}
            </div>
          ) : null}
          <div className="space-y-1.5">
            {isLoading ? (
              <>
                <Skeleton className={cn("h-7", isHero ? "w-44" : "w-36")} />
                {description ? <Skeleton className="h-3.5 w-full max-w-lg" /> : null}
              </>
            ) : (
              <>
                <h1
                  className={cn(
                    "font-semibold tracking-tight",
                    isHero ? "text-xl md:text-2xl" : "text-lg",
                  )}
                >
                  {title}
                </h1>
                {description ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>

        {meta || actions ? (
          <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
            {meta ? (
              <div className="flex flex-col items-start gap-2 md:items-end">
                {metaLabel ? (
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {metaLabel}
                  </span>
                ) : null}
                {isLoading ? <Skeleton className="h-7 w-24 rounded-full" /> : meta}
              </div>
            ) : null}
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

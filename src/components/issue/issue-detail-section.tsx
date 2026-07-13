import type { ReactNode } from "react";

import { cn, wrapText } from "@/lib/utils";

type IssueDetailSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function IssueDetailSection({
  title,
  description,
  children,
  className,
}: IssueDetailSectionProps) {
  return (
    <section className={cn("min-w-0 space-y-3", className)}>
      <div className="space-y-0.5">
        <h2 className="text-xs font-medium text-foreground">{title}</h2>
        {description ? (
          <p className={cn("text-xs text-muted-foreground", wrapText)}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

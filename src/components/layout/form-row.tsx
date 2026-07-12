import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormRowProps = {
  label: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
};

export function FormRow({ label, description, htmlFor, children, className }: FormRowProps) {
  return (
    <div
      className={cn(
        "grid gap-4 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,18rem)] lg:items-start lg:gap-8",
        className,
      )}
    >
      <div className="min-w-0 space-y-1 text-xs">
        <Label htmlFor={htmlFor}>{label}</Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
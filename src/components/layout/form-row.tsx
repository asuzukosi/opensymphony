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
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1 sm:max-w-md">
        <Label htmlFor={htmlFor}>{label}</Label>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="w-full shrink-0 sm:w-72">{children}</div>
    </div>
  );
}
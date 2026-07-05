import React from "react";
import { cn } from "@symphony/ui";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
  width?: "default" | "full";
};

export function PageShell({
  children,
  className,
  width = "default",
}: PageShellProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6",
        width === "default" && "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

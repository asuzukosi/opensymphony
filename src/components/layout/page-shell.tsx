import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  width?: "default" | "full";
};

export function PageShell({ children, className, width = "default" }: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-section px-page-x",
        width === "default" && "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

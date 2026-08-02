import type { ComponentProps } from "react";

import { Frame, FramePanel } from "@/components/ui/frame";
import { cn } from "@/lib/utils";

type SurfaceCardProps = ComponentProps<typeof FramePanel>;

export function SurfaceCard({ className, children, ...props }: SurfaceCardProps) {
  return (
    <Frame
      variant="ghost"
      spacing="sm"
      className="min-w-0 bg-transparent p-0 [--frame-panel-radius:var(--frame-radius)]"
    >
      <FramePanel className={cn("min-w-0 border-border/50", className)} {...props}>
        {children}
      </FramePanel>
    </Frame>
  );
}

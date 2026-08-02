import type { ReactNode } from "react";

import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { cn } from "@/lib/utils";

type PanelSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
  compact?: boolean;
};

export function PanelSection({ title, description, children, compact = false }: PanelSectionProps) {
  return (
    <Frame
      variant="ghost"
      spacing={compact ? "xs" : "sm"}
      className="min-w-0 bg-transparent p-0 [--frame-panel-radius:var(--frame-radius)]"
    >
      <FramePanel className="min-w-0 space-y-3 border-border/50">
        <FrameHeader className="px-0 py-0">
          <FrameTitle
            className={cn(
              compact ? "text-xs font-medium tracking-tight" : "text-sm font-medium tracking-tight",
            )}
          >
            {title}
          </FrameTitle>
          <FrameDescription
            className={cn(
              compact ? "text-[10px] text-muted-foreground" : "text-xs text-muted-foreground",
            )}
          >
            {description}
          </FrameDescription>
        </FrameHeader>
        {children}
      </FramePanel>
    </Frame>
  );
}

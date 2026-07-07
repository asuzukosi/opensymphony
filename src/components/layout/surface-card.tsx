import type { ComponentProps } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SurfaceCardProps = ComponentProps<typeof Card>;

export function SurfaceCard({ className, children, ...props }: SurfaceCardProps) {
  return (
    <Card className={cn("rounded-lg bg-card p-card", className)} {...props}>
      {children}
    </Card>
  );
}
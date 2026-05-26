import React from "react";
import { Card, cn } from "@symphony/ui";
import { surfaceCardClass } from "@/renderer/lib/surface-styles";

type SurfaceCardProps = React.ComponentProps<typeof Card>;

export function SurfaceCard({ className, ...props }: SurfaceCardProps): React.JSX.Element {
  return <Card className={cn(surfaceCardClass, className)} {...props} />;
}

import React from "react";
import { Badge, cn, type BadgeProps } from "@symphony/ui";
import type { RuntimeStatus } from "@/ipc";

export type RuntimeStatusBadgeValue = RuntimeStatus | "error";

const STATUS_LABEL: Record<RuntimeStatusBadgeValue, string> = {
  idle: "Idle",
  running: "Running",
  stopped: "Stopped",
  error: "Error",
};

const STATUS_VARIANT: Record<RuntimeStatusBadgeValue, NonNullable<BadgeProps["variant"]>> = {
  idle: "secondary",
  running: "default",
  stopped: "outline",
  error: "destructive",
};

const STATUS_DOT_CLASS: Record<RuntimeStatusBadgeValue, string> = {
  idle: "bg-muted-foreground",
  running: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  stopped: "bg-muted-foreground",
  error: "bg-destructive",
};

export function runtimeStatusBadgeVariant(
  status: RuntimeStatusBadgeValue,
): NonNullable<BadgeProps["variant"]> {
  return STATUS_VARIANT[status];
}

export function runtimeStatusLabel(status: RuntimeStatusBadgeValue): string {
  return STATUS_LABEL[status];
}

type RuntimeStatusBadgeProps = {
  status: RuntimeStatusBadgeValue;
  className?: string;
};

export function RuntimeStatusBadge({
  status,
  className,
}: RuntimeStatusBadgeProps): React.JSX.Element {
  return (
    <Badge
      variant={runtimeStatusBadgeVariant(status)}
      className={cn("gap-2 font-medium", className)}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          STATUS_DOT_CLASS[status],
          status === "running" ? "animate-pulse" : undefined,
        )}
        aria-hidden
      />
      {runtimeStatusLabel(status)}
    </Badge>
  );
}

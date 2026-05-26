import React from "react";
import { Badge, type BadgeProps } from "@symphony/ui";
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
    <Badge variant={runtimeStatusBadgeVariant(status)} className={className}>
      {runtimeStatusLabel(status)}
    </Badge>
  );
}

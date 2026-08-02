"use client";

import type { VariantProps } from "class-variance-authority";

import { BOARD_COLUMN_LABELS } from "@/components/board/board-states";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { BoardColumnId } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

type BoardColumnBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const BOARD_COLUMN_BADGE_VARIANTS: Record<BoardColumnId, BoardColumnBadgeVariant> = {
  backlog: "outline",
  inProgress: "default",
  review: "warning-light",
  done: "success-light",
};

type BoardColumnBadgeProps = {
  columnId: BoardColumnId;
  className?: string;
};

export function BoardColumnBadge({ columnId, className }: BoardColumnBadgeProps) {
  return (
    <Badge
      variant={BOARD_COLUMN_BADGE_VARIANTS[columnId]}
      size="xs"
      radius="full"
      className={cn("font-normal", className)}
    >
      {BOARD_COLUMN_LABELS[columnId]}
    </Badge>
  );
}

"use client";

import { BOARD_COLUMN_LABELS } from "@/components/board/board-states";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { BoardColumnId } from "@/lib/ipc/types";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

type BoardColumnBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const BOARD_COLUMN_BADGE_VARIANTS: Record<BoardColumnId, BoardColumnBadgeVariant> = {
  backlog: "outline",
  inProgress: "default",
  review: "warning",
  done: "success",
};

type BoardColumnBadgeProps = {
  columnId: BoardColumnId;
  className?: string;
};

export function BoardColumnBadge({ columnId, className }: BoardColumnBadgeProps) {
  return (
    <Badge
      variant={BOARD_COLUMN_BADGE_VARIANTS[columnId]}
      className={cn("rounded-full text-[10px] font-normal", className)}
    >
      {BOARD_COLUMN_LABELS[columnId]}
    </Badge>
  );
}

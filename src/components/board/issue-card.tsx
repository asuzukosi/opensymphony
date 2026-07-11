"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { IssuePriorityBadge } from "@/components/issue/issue-priority";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ProjectBoardIssue } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "from-violet-400 to-fuchsia-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
];

function avatarColorClass(identifier: string): string {
  let hash = 0;
  for (let index = 0; index < identifier.length; index += 1) {
    hash = identifier.charCodeAt(index) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function avatarLetter(identifier: string): string {
  const match = identifier.match(/[A-Za-z0-9]/);
  return (match?.[0] ?? "?").toUpperCase();
}

type IssueCardContentProps = {
  issue: ProjectBoardIssue;
  disabled?: boolean;
  onOpen?: (issue: ProjectBoardIssue) => void;
};

export function IssueCardContent({
  issue,
  disabled = false,
  onOpen,
}: IssueCardContentProps) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border/50 bg-card p-4 text-card-foreground shadow-sm transition-shadow",
        onOpen && "cursor-pointer hover:border-border hover:shadow-md",
        disabled && "opacity-60",
      )}
      onClick={() => {
        onOpen?.(issue);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-sm font-medium leading-snug">
          <Link
            href={`/issue/${issue.issueId}`}
            className="hover:text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {issue.title}
          </Link>
        </h3>
        <IssuePriorityBadge priority={issue.priority} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="size-6">
            <AvatarFallback
              className={cn(
                "bg-gradient-to-br text-[10px] font-medium text-white",
                avatarColorClass(issue.identifier),
              )}
            >
              {avatarLetter(issue.identifier)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate font-mono">{issue.identifier}</span>
        </div>
      </div>
    </article>
  );
}

type IssueCardProps = {
  issue: ProjectBoardIssue;
  isOverlay?: boolean;
  disabled?: boolean;
  dragEnabled?: boolean;
  onOpen?: (issue: ProjectBoardIssue) => void;
};

function DraggableIssueCard({
  issue,
  disabled = false,
  onOpen,
}: Omit<IssueCardProps, "isOverlay" | "dragEnabled">) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.issueId,
    data: { issue },
    disabled,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("touch-none", isDragging && "opacity-50")}
      {...listeners}
      {...attributes}
    >
      <IssueCardContent issue={issue} disabled={disabled} onOpen={onOpen} />
    </div>
  );
}

export function IssueCard({
  issue,
  isOverlay = false,
  disabled = false,
  dragEnabled = false,
  onOpen,
}: IssueCardProps) {
  if (isOverlay) {
    return (
      <div className="rotate-1 shadow-lg">
        <IssueCardContent issue={issue} disabled />
      </div>
    );
  }

  if (dragEnabled) {
    return <DraggableIssueCard issue={issue} disabled={disabled} onOpen={onOpen} />;
  }

  return <IssueCardContent issue={issue} disabled={disabled} onOpen={onOpen} />;
}

"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  BoltIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
} from "@/components/ui/hero-icons";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import type { ProjectBoardIssue } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

export function formatIssuePriority(priority: number | null): string | null {
  if (priority === null) {
    return null;
  }
  return `P${priority}`;
}

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

function IssueStatusIcon({
  priority,
  className,
}: {
  priority: number | null;
  className?: string;
}) {
  let Icon: ComponentType<SVGProps<SVGSVGElement>> = DocumentTextIcon;
  let tone = "text-muted-foreground/70";

  if (priority === 0 || priority === 1) {
    Icon = ExclamationCircleIcon;
    tone = "text-destructive";
  } else if (priority === 2) {
    Icon = BoltIcon;
    tone = "text-amber-500";
  }

  return <Icon className={cn("size-4 shrink-0", tone, className)} aria-hidden />;
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
  const priority = formatIssuePriority(issue.priority);

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
        <IssueStatusIcon priority={issue.priority} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-medium text-white",
              avatarColorClass(issue.identifier),
            )}
            aria-hidden
          >
            {avatarLetter(issue.identifier)}
          </span>
          <span className="truncate font-mono">{issue.identifier}</span>
        </div>
        {priority ? <span className="shrink-0 font-normal">{priority}</span> : null}
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

"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import type { HTMLAttributes } from "react";

import { Badge } from "@/components/ui/badge";
import { CardTitle } from "@/components/ui/card";
import type { ProjectBoardIssue } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

export function formatIssuePriority(priority: number | null): string | null {
  if (priority === null) {
    return null;
  }
  return `P${priority}`;
}

type IssueCardContentProps = {
  issue: ProjectBoardIssue;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  disabled?: boolean;
  onOpen?: (issue: ProjectBoardIssue) => void;
};

export function IssueCardContent({
  issue,
  dragHandleProps,
  disabled = false,
  onOpen,
}: IssueCardContentProps) {
  const priority = formatIssuePriority(issue.priority);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-muted/30 text-card-foreground shadow-none",
        onOpen && "cursor-pointer transition-colors hover:border-border hover:bg-muted/40",
      )}
      onClick={() => {
        onOpen?.(issue);
      }}
    >
      <div className="flex flex-row items-start gap-2 p-3">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed"
          aria-label={`Drag ${issue.identifier}`}
          disabled={disabled || !dragHandleProps}
          onClick={(event) => {
            event.stopPropagation();
          }}
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{issue.identifier}</span>
            {priority ? (
              <Badge variant="outline" className="font-normal">
                {priority}
              </Badge>
            ) : null}
          </div>
          <CardTitle className="text-sm font-medium leading-snug">
            <Link
              href={`/issue/${issue.issueId}`}
              className="hover:text-primary hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {issue.title}
            </Link>
          </CardTitle>
        </div>
      </div>
    </div>
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
      className={cn("touch-none transition-shadow", isDragging && "opacity-40")}
    >
      <IssueCardContent
        issue={issue}
        disabled={disabled}
        onOpen={onOpen}
        dragHandleProps={{ ...listeners, ...attributes }}
      />
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
      <div className="rotate-2">
        <IssueCardContent issue={issue} disabled />
      </div>
    );
  }

  if (dragEnabled) {
    return (
      <DraggableIssueCard issue={issue} disabled={disabled} onOpen={onOpen} />
    );
  }

  return <IssueCardContent issue={issue} disabled={disabled} onOpen={onOpen} />;
}

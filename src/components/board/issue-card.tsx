"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { IssuePriorityBadge } from "@/components/issue/issue-priority";
import { PlatformAvatar } from "@/components/ui/platform-avatar";
import type { ProjectBoardIssue } from "@/lib/ipc/types";
import { cn, summarizeText, wrapText } from "@/lib/utils";

type IssueCardContentProps = {
  issue: ProjectBoardIssue;
  disabled?: boolean;
  onOpen?: (issue: ProjectBoardIssue) => void;
};

function IssueCardContent({
  issue,
  disabled = false,
  onOpen,
}: IssueCardContentProps) {
  const summary = issue.description?.trim() ? summarizeText(issue.description, 72) : null;

  return (
    <article
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-border/50 bg-card p-3 text-card-foreground shadow-sm transition-shadow",
        onOpen && "cursor-pointer hover:border-border hover:shadow-md",
        disabled && "opacity-60",
      )}
      onClick={() => {
        onOpen?.(issue);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={cn("min-w-0 flex-1 text-xs font-medium leading-snug", wrapText)}>
          {issue.title}
        </h3>
        <IssuePriorityBadge priority={issue.priority} className="shrink-0" />
      </div>

      {summary ? (
        <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
          {summary}
        </p>
      ) : null}

      {issue.executor != null ? (
        <div className={cn("flex items-center", summary ? "mt-2" : "mt-2.5")}>
          <PlatformAvatar platformId={issue.executor} size="sm" />
        </div>
      ) : null}
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
      className={cn("touch-none min-w-0", isDragging && "opacity-50")}
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

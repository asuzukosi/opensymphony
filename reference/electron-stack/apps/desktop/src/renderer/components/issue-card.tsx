import React from "react";
import { Link } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge, CardTitle, cn } from "@symphony/ui";
import { GripVertical } from "lucide-react";
import { surfaceNestedCardClass } from "@/renderer/lib/surface-styles";
import type { ProjectBoardIssue } from "@/ipc";

type IssueCardProps = {
  issue: ProjectBoardIssue;
  isOverlay?: boolean;
  disabled?: boolean;
  onOpen?: (issue: ProjectBoardIssue) => void;
};

export function formatIssuePriority(priority: number | null): string | null {
  if (priority === null) {
    return null;
  }
  return `P${priority}`;
}

export function IssueCardContent({
  issue,
  dragHandleProps,
  disabled = false,
  onOpen,
}: {
  issue: ProjectBoardIssue;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  disabled?: boolean;
  onOpen?: (issue: ProjectBoardIssue) => void;
}): React.JSX.Element {
  const priority = formatIssuePriority(issue.priority);

  return (
    <div
      className={cn(
        "rounded-xl border text-card-foreground",
        surfaceNestedCardClass,
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
            {priority ? <Badge variant="outline">{priority}</Badge> : null}
          </div>
          <CardTitle className="text-sm font-medium leading-snug">
            <Link
              to={`/issues/${issue.issueId}`}
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

export function IssueCard({
  issue,
  isOverlay = false,
  disabled = false,
  onOpen,
}: IssueCardProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.issueId,
    data: { issue },
    disabled: disabled || isOverlay,
  });

  if (isOverlay) {
    return (
      <div className="rotate-2">
        <IssueCardContent issue={issue} disabled />
      </div>
    );
  }

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

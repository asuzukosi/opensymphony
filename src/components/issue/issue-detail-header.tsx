"use client";

import Link from "next/link";

import { BOARD_COLUMN_LABELS } from "@/components/board/board-states";
import { IssueColumnSelect } from "@/components/issue/issue-column-select";
import { IssuePriorityBadge } from "@/components/issue/issue-priority";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftIcon, DocumentTextIcon } from "@/components/ui/hero-icons";
import type { IssueDetail } from "@/hooks/use-issue";
import type { BoardColumnId } from "@/lib/ipc/types";

type IssueDetailHeaderProps = {
  issue: IssueDetail;
  onColumnChange?: (column: BoardColumnId) => Promise<void>;
  isTransitionPending?: boolean;
  transitionError?: Error | null;
};

export function IssueDetailHeader({
  issue,
  onColumnChange,
  isTransitionPending = false,
  transitionError = null,
}: IssueDetailHeaderProps) {
  const columnLabel = BOARD_COLUMN_LABELS[issue.boardColumn];
  const canChangeColumn = onColumnChange != null;

  return (
    <div className="space-y-4">
      <Link
        href="/board"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to board
      </Link>

      <PageHeader
        eyebrow={issue.identifier}
        icon={DocumentTextIcon}
        title={issue.title}
        description={
          issue.description
            ? issue.description.length > 160
              ? `${issue.description.slice(0, 160)}…`
              : issue.description
            : "No description provided."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canChangeColumn ? (
              <IssueColumnSelect
                currentColumn={issue.boardColumn}
                onColumnChange={onColumnChange}
                isPending={isTransitionPending}
                submitError={transitionError}
              />
            ) : (
              <Badge variant="secondary">{columnLabel}</Badge>
            )}
            <IssuePriorityBadge priority={issue.priority} />
          </div>
        }
      />
    </div>
  );
}

"use client";

import { BoardColumnBadge } from "@/components/board/board-column-badge";
import { IssueCommentsSection } from "@/components/issue/issue-comments-section";
import { IssueMetadata } from "@/components/issue/issue-metadata";
import { IssuePermissionsPanel } from "@/components/issue/issue-permissions-panel";
import { IssuePriorityBadge } from "@/components/issue/issue-priority";
import { IssueRunHistoryTable } from "@/components/issue/issue-run-history-table";
import {
  IssueErrorAlert,
  IssueNotFoundState,
  isIssueNotFoundError,
} from "@/components/issue/issue-states";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIssue } from "@/hooks/use-issue";
import { useIssueSheetParams } from "@/lib/issue-sheet-params";
import { cn, wrapText, wrapTextPreserve } from "@/lib/utils";

function IssueSheetLoadingState() {
  return (
    <div className="space-y-4 pr-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function IssueDetailSheetContent({ issueId }: { issueId: string }) {
  const { issue, error, isLoading, addComment, isMutating, mutationError } = useIssue({
    issueId,
    enabled: true,
  });
  const isInitialLoading = isLoading && issue === undefined;

  if (isInitialLoading) {
    return (
      <>
        <SheetTitle className="sr-only">Loading issue</SheetTitle>
        <IssueSheetLoadingState />
      </>
    );
  }

  if (!issue) {
    return (
      <>
        <SheetTitle className="sr-only">Issue not found</SheetTitle>
        <div className="space-y-4">
          {error && !isIssueNotFoundError(error) ? <IssueErrorAlert error={error} /> : null}
          <IssueNotFoundState issueId={issueId} />
        </div>
      </>
    );
  }

  return (
    <article className="min-w-0 divide-y divide-border/60 pr-6">
      <header className="space-y-3 pb-6">
        <SheetTitle className={cn("text-sm font-medium leading-snug", wrapText)}>
          {issue.title}
        </SheetTitle>
        <SheetDescription className={cn("text-xs", wrapTextPreserve)}>
          {issue.description ?? "No description provided."}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-2">
          <BoardColumnBadge columnId={issue.boardColumn} />
          <IssuePriorityBadge priority={issue.priority} className="text-[10px]" />
        </div>
      </header>

      {error ? (
        <div className="py-6">
          <IssueErrorAlert error={error} />
        </div>
      ) : null}

      <div className="py-6 empty:hidden">
        <IssuePermissionsPanel issueId={issueId} attempts={issue.attempts} />
      </div>

      <div className="space-y-8 py-6">
        <IssueMetadata issue={issue} />
        <IssueCommentsSection
          comments={issue.comments}
          onAddComment={addComment}
          isPending={isMutating}
          submitError={mutationError}
        />
        <IssueRunHistoryTable attempts={issue.attempts} sessionEvents={issue.sessionEvents} />
      </div>
    </article>
  );
}

type IssueDetailSheetProps = {
  issueId: string | null;
  open: boolean;
  onClose: () => void;
};

export function IssueDetailSheet({ issueId, open, onClose }: IssueDetailSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <SheetContent side="right" className="w-full min-w-0 overflow-y-auto sm:max-w-xl">
        {issueId != null ? <IssueDetailSheetContent issueId={issueId} /> : null}
      </SheetContent>
    </Sheet>
  );
}

export function IssueSheetHost() {
  const { issueId, isOpen, closeIssueSheet } = useIssueSheetParams();

  return <IssueDetailSheet issueId={issueId} open={isOpen} onClose={closeIssueSheet} />;
}

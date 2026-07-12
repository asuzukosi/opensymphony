"use client";

import { useState } from "react";

import { BOARD_COLUMN_LABELS } from "@/components/board/board-states";
import { IssueCommentsSection } from "@/components/issue/issue-comments-section";
import { IssueMetadata } from "@/components/issue/issue-metadata";
import { IssuePermissionsPanel } from "@/components/issue/issue-permissions-panel";
import { IssuePriorityBadge } from "@/components/issue/issue-priority";
import { IssueRunHistoryTable } from "@/components/issue/issue-run-history-table";
import {
  IssueErrorAlert,
  IssueNotFoundState,
  IssueSheetLoadingState,
  isIssueNotFoundError,
} from "@/components/issue/issue-states";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIssueSheet } from "@/contexts/issue-sheet-context";
import { useIssue } from "@/hooks/use-issue";
import type { PlatformId } from "@/lib/ipc/types";

function IssueDetailSheetContent({ issueId }: { issueId: string }) {
  const {
    issue,
    error,
    isLoading,
    updatePriority,
    setExecutor,
    setAutoApprovePermissions,
    setTags,
    attachFiles,
    addComment,
    isMutating,
    mutationError,
    resetMutation,
  } = useIssue({ issueId, enabled: true });
  const [failedComment, setFailedComment] = useState(false);
  const [failedExecutor, setFailedExecutor] = useState(false);
  const [failedMetadata, setFailedMetadata] = useState(false);
  const isInitialLoading = isLoading && issue === undefined;

  const handleAddComment = async (body: string): Promise<void> => {
    resetMutation();
    setFailedComment(false);

    try {
      await addComment(body);
    } catch (commentError) {
      setFailedComment(true);
      throw commentError;
    }
  };

  const handleExecutorChange = async (executor: PlatformId | null): Promise<void> => {
    resetMutation();
    setFailedExecutor(false);

    try {
      await setExecutor(executor);
    } catch {
      setFailedExecutor(true);
    }
  };

  const handleAutoApprovePermissionsChange = async (
    autoApprovePermissions: boolean,
  ): Promise<void> => {
    resetMutation();
    setFailedMetadata(false);

    try {
      await setAutoApprovePermissions(autoApprovePermissions);
    } catch {
      setFailedMetadata(true);
    }
  };

  const handleMetadataChange = async (action: () => Promise<void>): Promise<void> => {
    resetMutation();
    setFailedMetadata(false);

    try {
      await action();
    } catch {
      setFailedMetadata(true);
    }
  };

  if (isInitialLoading) {
    return <IssueSheetLoadingState />;
  }

  if (!issue) {
    return (
      <div className="space-y-4">
        {error && !isIssueNotFoundError(error) ? <IssueErrorAlert error={error} /> : null}
        <IssueNotFoundState issueId={issueId} />
      </div>
    );
  }

  const columnLabel = BOARD_COLUMN_LABELS[issue.boardColumn];

  return (
    <div className="space-y-6 pr-6">
      <SheetHeader className="space-y-3 text-left">
        <p className="font-mono text-xs text-muted-foreground">{issue.identifier}</p>
        <SheetTitle className="text-base font-medium leading-snug">{issue.title}</SheetTitle>
        <SheetDescription className="text-sm">
          {issue.description ?? "No description provided."}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary">{columnLabel}</Badge>
          <IssuePriorityBadge priority={issue.priority} />
        </div>
      </SheetHeader>

      {error ? <IssueErrorAlert error={error} /> : null}

      <IssuePermissionsPanel issueId={issueId} attempts={issue.attempts} />

      <IssueMetadata
        issue={issue}
        onExecutorChange={handleExecutorChange}
        onAutoApprovePermissionsChange={handleAutoApprovePermissionsChange}
        onPriorityChange={(priority) => handleMetadataChange(() => updatePriority(priority))}
        onTagsChange={(tags) => handleMetadataChange(() => setTags(tags))}
        onAttachFiles={(filePaths) => handleMetadataChange(() => attachFiles(filePaths))}
        isMutating={isMutating}
        mutationError={failedExecutor || failedMetadata ? mutationError : null}
      />

      <IssueCommentsSection
        comments={issue.comments}
        onAddComment={handleAddComment}
        isPending={isMutating}
        submitError={failedComment ? mutationError : null}
      />

      <IssueRunHistoryTable attempts={issue.attempts} sessionEvents={issue.sessionEvents} />
    </div>
  );
}

export function IssueDetailSheet() {
  const { issueId, isOpen, closeIssueSheet } = useIssueSheet();

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeIssueSheet();
        }
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {issueId != null ? <IssueDetailSheetContent issueId={issueId} /> : null}
      </SheetContent>
    </Sheet>
  );
}

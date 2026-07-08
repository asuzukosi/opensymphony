"use client";

import Link from "next/link";

import { formatIssuePriority } from "@/components/board/issue-card";
import { BOARD_COLUMN_LABELS } from "@/components/board/board-states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_IPC_POLL_INTERVAL_MS, useIpcQuery } from "@/lib/ipc/hooks";
import type { IssueHeader } from "@/lib/ipc/types";

type IssueDetailSheetProps = {
  issueId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function IssueSheetPreview({ issue }: { issue: IssueHeader }) {
  const priority = formatIssuePriority(issue.priority);
  const columnLabel = BOARD_COLUMN_LABELS[issue.boardColumn];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{columnLabel}</Badge>
        {priority ? (
          <Badge variant="outline" className="font-normal">
            {priority}
          </Badge>
        ) : null}
      </div>
      {issue.description ? (
        <p className="whitespace-pre-wrap text-sm">{issue.description}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No description provided.</p>
      )}
    </div>
  );
}

function IssueSheetLoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function IssueSheetErrorState({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Issue unavailable</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

export function IssueDetailSheet({ issueId, open, onOpenChange }: IssueDetailSheetProps) {
  const { data: issue, error, isLoading } = useIpcQuery<IssueHeader>(
    `issue-header:${issueId ?? "none"}`,
    async (client) => client.getIssueHeader(issueId as string),
    {
      pollIntervalMs: DEFAULT_IPC_POLL_INTERVAL_MS,
      enabled: open && issueId != null,
    },
  );

  const isInitialLoading = isLoading && issue === undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">
            {issue?.identifier ?? issueId ?? "Issue"}
          </SheetTitle>
          <SheetDescription>{issue?.title ?? "Loading issue details..."}</SheetDescription>
        </SheetHeader>

        <div className="py-2">
          {isInitialLoading ? <IssueSheetLoadingState /> : null}
          {!isInitialLoading && error ? <IssueSheetErrorState error={error} /> : null}
          {!isInitialLoading && issue ? <IssueSheetPreview issue={issue} /> : null}
        </div>

        {issue ? (
          <SheetFooter className="mt-6 sm:justify-start">
            <Button asChild>
              <Link
                href={`/issue/${issue.issueId}`}
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Open full page
              </Link>
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

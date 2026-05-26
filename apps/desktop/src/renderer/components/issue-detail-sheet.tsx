import React from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@symphony/ui";
import { formatIssuePriority } from "@/renderer/components/issue-card";
import { IssueErrorAlert } from "@/renderer/components/issue-error-alert";
import { useIssue } from "@/renderer/hooks";
import type { IssueDetail } from "@/ipc";

type IssueDetailSheetProps = {
  issueId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function IssueSheetPreview({ issue }: { issue: IssueDetail }): React.JSX.Element {
  const priority = formatIssuePriority(issue.priority);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{issue.workflowStateName}</Badge>
        {priority ? <Badge variant="outline">{priority}</Badge> : null}
      </div>
      {issue.description ? (
        <p className="whitespace-pre-wrap text-sm">{issue.description}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No description provided.</p>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
        <p>{issue.comments.length} comment{issue.comments.length === 1 ? "" : "s"}</p>
        <p>
          {issue.attempts.length} run attempt{issue.attempts.length === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

function IssueSheetLoadingState(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}

export function IssueDetailSheet({
  issueId,
  open,
  onOpenChange,
}: IssueDetailSheetProps): React.JSX.Element {
  const { issue, error, isLoading } = useIssue({
    issueId,
    enabled: open && issueId != null,
  });
  const isInitialLoading = isLoading && !issue;

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
          {!isInitialLoading && error ? <IssueErrorAlert error={error} /> : null}
          {!isInitialLoading && issue ? <IssueSheetPreview issue={issue} /> : null}
        </div>

        {issue ? (
          <SheetFooter className="mt-6 sm:justify-start">
            <Button asChild>
              <Link
                to={`/issues/${issue.issueId}`}
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                View full issue
              </Link>
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

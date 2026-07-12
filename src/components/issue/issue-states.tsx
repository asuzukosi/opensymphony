"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QuestionMarkCircleIcon } from "@/components/ui/hero-icons";
import { Skeleton } from "@/components/ui/skeleton";

export function IssueSheetLoadingState() {
  return (
    <div className="space-y-4 pr-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

type IssueNotFoundStateProps = {
  issueId: string;
};

export function IssueNotFoundState({ issueId }: IssueNotFoundStateProps) {
  return (
    <Alert>
      <QuestionMarkCircleIcon className="h-4 w-4" />
      <AlertTitle>Issue not found</AlertTitle>
      <AlertDescription>
        No issue exists for id <span className="font-mono">{issueId}</span>.
      </AlertDescription>
    </Alert>
  );
}

type IssueErrorAlertProps = {
  error: Error;
};

export function IssueErrorAlert({ error }: IssueErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Issue unavailable</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

export function isIssueNotFoundError(error: Error): boolean {
  return error.message.toLowerCase().includes("not found");
}

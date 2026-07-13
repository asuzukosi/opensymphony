"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QuestionMarkCircleIcon } from "@/components/ui/hero-icons";
import { cn, wrapText } from "@/lib/utils";

type IssueNotFoundStateProps = {
  issueId?: string;
};

export function IssueNotFoundState({ issueId: _issueId }: IssueNotFoundStateProps) {
  return (
    <Alert className="text-xs">
      <QuestionMarkCircleIcon className="h-4 w-4" />
      <AlertTitle>Issue not found</AlertTitle>
      <AlertDescription className={cn("text-xs", wrapText)}>
        This issue may have been deleted or is no longer available.
      </AlertDescription>
    </Alert>
  );
}

type IssueErrorAlertProps = {
  error: Error;
};

export function IssueErrorAlert({ error }: IssueErrorAlertProps) {
  return (
    <Alert variant="destructive" className="text-xs">
      <AlertTitle>Issue unavailable</AlertTitle>
      <AlertDescription className={cn("text-xs", wrapText)}>{error.message}</AlertDescription>
    </Alert>
  );
}

export function isIssueNotFoundError(error: Error): boolean {
  return error.message.toLowerCase().includes("not found");
}

"use client";

import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/layout/surface-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardContent, CardHeader } from "@/components/ui/card";
import { QuestionMarkCircleIcon } from "@/components/ui/hero-icons";
import { Skeleton } from "@/components/ui/skeleton";

export function IssueLoadingState() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Loading issue"
        description="Fetching issue details from the local tracker."
        isLoading
      />
      <SurfaceCard>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </CardContent>
      </SurfaceCard>
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
        No issue exists for id <span className="font-mono">{issueId}</span>.{" "}
        <Link href="/board" className="font-medium text-primary hover:underline">
          Return to board
        </Link>
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

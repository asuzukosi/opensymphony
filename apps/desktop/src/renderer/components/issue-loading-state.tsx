import React from "react";
import { CardContent, CardHeader, Skeleton } from "@symphony/ui";
import { PageHeader } from "@/renderer/layout/page-header";
import { SurfaceCard } from "@/renderer/layout/surface-card";

export function IssueLoadingState(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title="Loading issue" description="Fetching issue details from the local tracker." isLoading />
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

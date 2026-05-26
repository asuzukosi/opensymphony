import React from "react";
import { Bot } from "lucide-react";
import { CardContent, CardHeader, Skeleton } from "@symphony/ui";
import { PageHeader } from "@/renderer/layout/page-header";
import { SurfaceCard } from "@/renderer/layout/surface-card";

function AgentsColumnSkeleton(): React.JSX.Element {
  return (
    <SurfaceCard className="flex min-h-[28rem] flex-col">
      <CardHeader className="space-y-2 pb-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 px-3 pb-3 pt-0">
        <Skeleton className="h-[20rem] w-full rounded-lg" />
      </CardContent>
    </SurfaceCard>
  );
}

export function AgentsLoadingState(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agent pipeline"
        icon={Bot}
        title="Agents"
        description="Monitor dispatch candidates, active sessions, retries, and recent activity."
        isLoading
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <AgentsColumnSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

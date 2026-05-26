import React, { useMemo } from "react";
import { History } from "lucide-react";
import {
  Badge,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
} from "@symphony/ui";
import { MetadataField } from "@/renderer/layout/metadata-field";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import { surfacePanelClass } from "@/renderer/lib/surface-styles";
import { cn } from "@symphony/ui";
import type { RuntimeStateSnapshot } from "@/ipc";

type DashboardRuntimeSnapshotProps = {
  snapshot?: RuntimeStateSnapshot;
  isLoading?: boolean;
};

function RuntimeSnapshotSkeleton(): React.JSX.Element {
  return (
    <SurfaceCard>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

export function DashboardRuntimeSnapshot({
  snapshot,
  isLoading = false,
}: DashboardRuntimeSnapshotProps): React.JSX.Element | null {
  const recentEvents = snapshot?.recentEvents ?? [];

  const lastTick = useMemo(() => {
    if (!snapshot?.lastTickAt) return "Never";
    return new Date(snapshot.lastTickAt).toLocaleString();
  }, [snapshot?.lastTickAt]);
  const startedAt = useMemo(() => {
    if (!snapshot?.startedAt) return "Not started";
    return new Date(snapshot.startedAt).toLocaleString();
  }, [snapshot?.startedAt]);
  const nextTickAt = useMemo(() => {
    if (!snapshot?.nextTickAt) return "n/a";
    return new Date(snapshot.nextTickAt).toLocaleString();
  }, [snapshot?.nextTickAt]);

  if (isLoading) {
    return <RuntimeSnapshotSkeleton />;
  }

  if (!snapshot) {
    return null;
  }

  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Runtime snapshot</CardTitle>
        <CardDescription>Live counters and recent orchestration events.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <MetadataField
            label="Runtime adapter"
            value={
              <Badge variant="outline" className="font-normal">
                {snapshot.runtimeAdapterKind}
              </Badge>
            }
          />
          <MetadataField label="Started at" value={startedAt} />
          <MetadataField
            label="Poll interval"
            value={<span className="font-mono tabular-nums">{snapshot.pollIntervalMs} ms</span>}
          />
          <MetadataField label="Next tick" value={nextTickAt} />
          <MetadataField label="Last tick" value={lastTick} />
          <MetadataField
            label="Total ticks"
            value={<span className="font-mono tabular-nums">{snapshot.tickCount}</span>}
          />
          <MetadataField
            label="Last dispatched"
            value={<span className="font-mono tabular-nums">{snapshot.lastDispatchedCount}</span>}
          />
          <MetadataField
            label="Last deferred"
            value={<span className="font-mono tabular-nums">{snapshot.lastDeferredCount}</span>}
          />
          <MetadataField
            label="Last cancelled"
            value={<span className="font-mono tabular-nums">{snapshot.lastCancelledCount}</span>}
          />
          <MetadataField label="Last action" value={snapshot.lastAction ?? "n/a"} />
          <MetadataField
            label="Last error"
            value={
              snapshot.lastError ? (
                <span className="text-destructive">{snapshot.lastError}</span>
              ) : (
                "none"
              )
            }
          />
        </dl>

        <Separator className="bg-border/60" />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold tracking-tight">Recent events</h4>
          </div>
          {recentEvents.length > 0 ? (
            <ul className="space-y-2">
              {recentEvents.map((event, index) => (
                <li
                  key={`${event.createdAt}-${index}`}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2 text-sm",
                    surfacePanelClass,
                  )}
                >
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                  <span className="text-foreground">
                    {event.action}
                    {event.issueId ? (
                      <span className="text-muted-foreground"> · {event.issueId}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No recent orchestration events.</p>
          )}
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

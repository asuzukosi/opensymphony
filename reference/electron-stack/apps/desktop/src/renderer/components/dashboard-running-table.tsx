import React from "react";
import { PlayCircle } from "lucide-react";
import {
  Badge,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@symphony/ui";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import { surfaceEmptyStateClass, surfaceTableWrapClass } from "@/renderer/lib/surface-styles";
import type { RuntimeRunningEntry } from "@/ipc";
import { formatSessionPhase } from "@/renderer/lib/format-session-phase";

type DashboardRunningTableProps = {
  running?: RuntimeRunningEntry[];
  isLoading?: boolean;
};

function formatStartedAt(startedAt: string): string {
  const parsed = Date.parse(startedAt);
  if (Number.isNaN(parsed)) {
    return startedAt;
  }
  return new Date(parsed).toLocaleString();
}

function RunningTableSkeleton(): React.JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Issue</TableHead>
          <TableHead>Attempt</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Phase</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 3 }, (_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-8" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16 rounded-full" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RunningTableEmptyState(): React.JSX.Element {
  return (
    <div className={surfaceEmptyStateClass}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <PlayCircle className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No running sessions</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Active agent sessions will appear here when the orchestrator dispatches work.
      </p>
    </div>
  );
}

export function DashboardRunningTable({
  running,
  isLoading = false,
}: DashboardRunningTableProps): React.JSX.Element {
  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Running Sessions</CardTitle>
        <CardDescription>Live run attempts with attached agent sessions.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <RunningTableSkeleton />
        ) : running && running.length > 0 ? (
          <div className={surfaceTableWrapClass}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs uppercase tracking-wide">Issue</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Attempt</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Started</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Phase</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {running.map((entry) => (
                  <TableRow key={entry.runAttemptId} className="hover:bg-muted/20">
                    <TableCell className="font-medium">{entry.identifier}</TableCell>
                    <TableCell className="font-mono tabular-nums">{entry.attemptNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{formatStartedAt(entry.startedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal capitalize">
                        {formatSessionPhase(entry.phase)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal capitalize">
                        {entry.sessionStatus ?? "unknown"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <RunningTableEmptyState />
        )}
      </CardContent>
    </SurfaceCard>
  );
}

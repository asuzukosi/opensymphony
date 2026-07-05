import React from "react";
import { RotateCcw } from "lucide-react";
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
import type { RuntimeRetryEntry } from "@/ipc";

type DashboardRetryTableProps = {
  retrying?: RuntimeRetryEntry[];
  isLoading?: boolean;
};

function formatDueAt(dueAt: string): string {
  const parsed = Date.parse(dueAt);
  if (Number.isNaN(parsed)) {
    return dueAt;
  }
  return new Date(parsed).toLocaleString();
}

function RetryTableSkeleton(): React.JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Issue</TableHead>
          <TableHead>Attempt</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Error</TableHead>
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
              <Skeleton className="h-4 w-40" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RetryTableEmptyState(): React.JSX.Element {
  return (
    <div className={surfaceEmptyStateClass}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <RotateCcw className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No retry queue entries</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Failed run attempts scheduled for retry will appear here.
      </p>
    </div>
  );
}

export function DashboardRetryTable({
  retrying,
  isLoading = false,
}: DashboardRetryTableProps): React.JSX.Element {
  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Retry Queue</CardTitle>
        <CardDescription>Issues waiting to be retried after a failed run attempt.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <RetryTableSkeleton />
        ) : retrying && retrying.length > 0 ? (
          <div className={surfaceTableWrapClass}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs uppercase tracking-wide">Issue</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Attempt</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Due</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retrying.map((entry) => (
                  <TableRow key={entry.issueId} className="hover:bg-muted/20">
                    <TableCell className="font-medium">{entry.identifier}</TableCell>
                    <TableCell className="font-mono tabular-nums">{entry.attemptNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDueAt(entry.dueAt)}</TableCell>
                    <TableCell className="max-w-[320px]">
                      {entry.errorMessage ? (
                        <Badge
                          variant="destructive"
                          className="max-w-full truncate font-normal"
                          title={entry.errorMessage}
                        >
                          {entry.errorMessage}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No error recorded</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <RetryTableEmptyState />
        )}
      </CardContent>
    </SurfaceCard>
  );
}

"use client";

import type { VariantProps } from "class-variance-authority";
import { IssueDetailSection } from "@/components/issue/issue-detail-section";
import { IssueSessionTimeline } from "@/components/issue/issue-session-timeline";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/datetime";
import type { IssueDetailRunAttempt, SessionEvent } from "@/lib/ipc/types";
import { cn, wrapText, wrapTextPreserve } from "@/lib/utils";

type IssueRunHistoryTableProps = {
  attempts?: IssueDetailRunAttempt[];
  sessionEvents?: SessionEvent[];
  isLoading?: boolean;
};

function formatTimestamp(value: string | null): string {
  return formatDateTime(value, "Running");
}

function statusBadgeVariant(
  status: string,
): NonNullable<VariantProps<typeof badgeVariants>["variant"]> {
  if (status === "succeeded") {
    return "success";
  }
  if (status === "failed") {
    return "destructive";
  }
  if (status === "cancelled" || status === "canceled") {
    return "outline";
  }
  return "secondary";
}

function RunHistoryTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Attempt</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Finished</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 3 }, (_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-12" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-32" />
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

export function IssueRunHistoryTable({
  attempts,
  sessionEvents = [],
  isLoading = false,
}: IssueRunHistoryTableProps) {
  const hasAttempts = attempts != null && attempts.length > 0;

  return (
    <div className="min-w-0 space-y-8">
      <IssueDetailSection title="Run history" description="Run attempts for this issue.">
        {isLoading ? (
          <RunHistoryTableSkeleton />
        ) : hasAttempts ? (
          <Table className="w-full table-fixed text-xs">
            <TableHeader>
              <TableRow className="border-b border-border/60 hover:bg-transparent">
                <TableHead className="h-8 text-[10px]">Attempt</TableHead>
                <TableHead className="h-8 text-[10px]">Status</TableHead>
                <TableHead className="h-8 text-[10px]">Started</TableHead>
                <TableHead className="h-8 text-[10px]">Finished</TableHead>
                <TableHead className="h-8 text-[10px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow
                  key={attempt.runAttemptId}
                  className="border-b border-border/40 hover:bg-transparent"
                >
                  <TableCell className="p-1.5 text-[10px] tabular-nums text-muted-foreground">
                    #{attempt.attemptNumber}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      variant={statusBadgeVariant(attempt.status)}
                      className="h-4 px-1.5 py-0 text-[8px] font-normal capitalize"
                    >
                      {attempt.status}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn("py-2 text-[10px] leading-tight text-muted-foreground", wrapText)}
                  >
                    {formatTimestamp(attempt.startedAt)}
                  </TableCell>
                  <TableCell
                    className={cn("py-2 text-[10px] leading-tight text-muted-foreground", wrapText)}
                  >
                    {formatTimestamp(attempt.finishedAt)}
                  </TableCell>
                  <TableCell className="min-w-0 max-w-[320px] py-2">
                    {attempt.errorMessage ? (
                      <p className={cn("text-xs text-destructive", wrapTextPreserve)}>
                        {attempt.errorMessage}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-muted-foreground">
            Run attempts will appear here after the orchestrator dispatches this issue.
          </p>
        )}
      </IssueDetailSection>

      <IssueDetailSection
        title="Session timeline"
        description="Prompt, tool, permission, and error events from agent runs."
      >
        <IssueSessionTimeline
          events={sessionEvents}
          isLoading={isLoading}
          emptyMessage="Session events will appear here after an agent run records activity."
        />
      </IssueDetailSection>
    </div>
  );
}

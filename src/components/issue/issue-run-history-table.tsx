"use client";

import { SurfaceCard } from "@/components/layout/surface-card";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format-date-time";
import type { IssueDetailRunAttempt, IssueDetailSession, SessionEvent } from "@/lib/ipc/types";
import { IssueSessionTimeline } from "@/components/issue/issue-session-timeline";

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
): "default" | "secondary" | "destructive" | "outline" {
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

function RunHistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
      <p className="text-sm font-medium">No run history</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Run attempts will appear here after the orchestrator dispatches this issue.
      </p>
    </div>
  );
}

function SessionRow({ session }: { session: IssueDetailSession }) {
  const latestEvent = session.events.at(-1);

  return (
    <TableRow className="bg-muted/20 hover:bg-muted/30">
      <TableCell className="pl-8 font-mono text-xs text-muted-foreground">
        Session {session.sessionId.slice(0, 8)}
      </TableCell>
      <TableCell>
        <Badge variant={statusBadgeVariant(session.status)} className="font-normal capitalize">
          {session.status}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatTimestamp(session.startedAt)}</TableCell>
      <TableCell className="text-muted-foreground">{formatTimestamp(session.finishedAt)}</TableCell>
      <TableCell className="max-w-[320px]">
        <div className="space-y-1 text-xs text-muted-foreground">
          {latestEvent ? <p>Last event: {latestEvent.kind}</p> : null}
          {session.sessionRef ? (
            <p className="truncate font-mono" title={session.sessionRef}>
              {session.sessionRef}
            </p>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function AttemptRows({ attempt }: { attempt: IssueDetailRunAttempt }) {
  return (
    <>
      <TableRow className="hover:bg-muted/20">
        <TableCell className="font-medium tabular-nums">#{attempt.attemptNumber}</TableCell>
        <TableCell>
          <Badge variant={statusBadgeVariant(attempt.status)} className="font-normal capitalize">
            {attempt.status}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground">{formatTimestamp(attempt.startedAt)}</TableCell>
        <TableCell className="text-muted-foreground">{formatTimestamp(attempt.finishedAt)}</TableCell>
        <TableCell className="max-w-[320px]">
          {attempt.errorMessage ? (
            <p className="truncate text-sm text-destructive" title={attempt.errorMessage}>
              {attempt.errorMessage}
            </p>
          ) : attempt.sessions.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {attempt.sessions.length} session{attempt.sessions.length === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">No sessions</span>
          )}
        </TableCell>
      </TableRow>
      {attempt.sessions.map((session) => (
        <SessionRow key={session.sessionId} session={session} />
      ))}
    </>
  );
}

export function IssueRunHistoryTable({
  attempts,
  sessionEvents = [],
  isLoading = false,
}: IssueRunHistoryTableProps) {
  const hasAttempts = attempts != null && attempts.length > 0;

  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Run history</CardTitle>
        <CardDescription>Run attempts and agent sessions for this issue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <RunHistoryTableSkeleton />
        ) : hasAttempts ? (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs uppercase tracking-wide">Attempt</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Started</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Finished</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => (
                  <AttemptRows key={attempt.runAttemptId} attempt={attempt} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <RunHistoryEmptyState />
        )}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Session timeline</h3>
            <p className="text-sm text-muted-foreground">
              Prompt, tool, permission, and error events from agent runs.
            </p>
          </div>
          <IssueSessionTimeline
            events={sessionEvents}
            isLoading={isLoading}
            emptyMessage="Session events will appear here after an agent run records activity."
          />
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

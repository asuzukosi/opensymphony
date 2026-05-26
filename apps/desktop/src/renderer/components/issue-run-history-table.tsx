import React from "react";
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
  type BadgeProps,
} from "@symphony/ui";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import { surfaceEmptyStateClass, surfaceTableWrapClass } from "@/renderer/lib/surface-styles";
import type { IssueDetailRunAttempt, IssueDetailSession } from "@/ipc";

type IssueRunHistoryTableProps = {
  attempts?: IssueDetailRunAttempt[];
  isLoading?: boolean;
};

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Running";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString();
}

function formatRuntimeKind(kind: string): string {
  if (kind === "mock-acp") {
    return "Mock";
  }
  if (kind === "acp-cli") {
    return "CLI";
  }
  return kind;
}

function statusBadgeVariant(status: string): NonNullable<BadgeProps["variant"]> {
  if (status === "failed") {
    return "destructive";
  }
  if (status === "cancelled" || status === "canceled") {
    return "outline";
  }
  return "secondary";
}

function RunHistoryTableSkeleton(): React.JSX.Element {
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

function RunHistoryEmptyState(): React.JSX.Element {
  return (
    <div className={surfaceEmptyStateClass}>
      <p className="text-sm font-medium">No run history</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Run attempts will appear here after the orchestrator dispatches this issue.
      </p>
    </div>
  );
}

function SessionRow({ session }: { session: IssueDetailSession }): React.JSX.Element {
  return (
    <TableRow className="bg-muted/20 hover:bg-muted/30">
      <TableCell className="pl-8 font-mono text-xs text-muted-foreground">
        Session {session.sessionId.slice(0, 8)}
      </TableCell>
      <TableCell>
        <Badge variant={statusBadgeVariant(session.status)}>{session.status}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatTimestamp(session.startedAt)}</TableCell>
      <TableCell className="text-muted-foreground">{formatTimestamp(session.finishedAt)}</TableCell>
      <TableCell className="max-w-[320px]">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{formatRuntimeKind(session.runtimeKind)}</p>
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

function AttemptRows({ attempt }: { attempt: IssueDetailRunAttempt }): React.JSX.Element {
  return (
    <>
      <TableRow className="hover:bg-muted/20">
        <TableCell className="font-medium tabular-nums">#{attempt.attemptNumber}</TableCell>
        <TableCell>
          <Badge variant={statusBadgeVariant(attempt.status)}>{attempt.status}</Badge>
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
  isLoading = false,
}: IssueRunHistoryTableProps): React.JSX.Element {
  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Run history</CardTitle>
        <CardDescription>Run attempts and agent sessions for this issue.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <RunHistoryTableSkeleton />
        ) : attempts && attempts.length > 0 ? (
          <div className={surfaceTableWrapClass}>
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
      </CardContent>
    </SurfaceCard>
  );
}

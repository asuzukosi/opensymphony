import React, { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symphony/ui";
import { useIssue } from "@/renderer/hooks/use-issue";
import { useRuntimeState } from "@/renderer/hooks/use-runtime-state";

export function Issues(): React.JSX.Element {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const { snapshot, error: runtimeError, isLoading } = useRuntimeState();
  const {
    issue,
    isLoading: issueLoading,
    isRefreshing: issueRefreshing,
    refetch: refetchIssue,
  } = useIssue({ issueId: selectedIssueId });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">Loading runtime state...</CardContent>
      </Card>
    );
  }
  if (runtimeError) {
    return (
      <Card>
        <CardContent className="pt-6">Runtime error: {runtimeError.message}</CardContent>
      </Card>
    );
  }
  if (!snapshot) {
    return (
      <Card>
        <CardContent className="pt-6">No runtime data available.</CardContent>
      </Card>
    );
  }

  const issueBusy = issueLoading || issueRefreshing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Issue Queues</CardTitle>
        <CardDescription>Running attempts, retries, candidates, and per-issue run history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Running ({snapshot.running.length})
          </h3>
          <ul className="m-0 list-disc space-y-1 pl-5">
            {snapshot.running.map((item) => (
              <li
                key={item.runAttemptId}
                onClick={() => setSelectedIssueId(item.issueId)}
                style={{ cursor: "pointer" }}
              >
                {item.identifier} attempt #{item.attemptNumber}
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Retry Queue ({snapshot.retrying.length})
          </h3>
          <ul className="m-0 list-disc space-y-1 pl-5">
            {snapshot.retrying.map((item) => (
              <li
                key={item.issueId}
                onClick={() => setSelectedIssueId(item.issueId)}
                style={{ cursor: "pointer" }}
              >
                {item.identifier} attempt #{item.attemptNumber} due{" "}
                {new Date(item.dueAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Candidates ({snapshot.candidates.length})
          </h3>
          <ul className="m-0 list-disc space-y-1 pl-5">
            {snapshot.candidates.map((item) => (
              <li
                key={item.issueId}
                onClick={() => setSelectedIssueId(item.issueId)}
                style={{ cursor: "pointer" }}
              >
                {item.identifier}: {item.title}
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Run History {selectedIssueId ? `(${selectedIssueId})` : ""}
          </h3>
          {selectedIssueId ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void refetchIssue()}
              disabled={issueBusy}
            >
              {issueBusy ? "Refreshing..." : "Refresh History"}
            </Button>
          ) : null}
          {issue ? (
            <ul className="m-0 list-disc space-y-3 pl-5">
              {issue.attempts.map((attempt) => (
                <li key={attempt.runAttemptId}>
                  <div>
                    #{attempt.attemptNumber} {attempt.status}
                  </div>
                  <div>started: {new Date(attempt.startedAt).toLocaleString()}</div>
                  <div>
                    finished:{" "}
                    {attempt.finishedAt ? new Date(attempt.finishedAt).toLocaleString() : "running"}
                  </div>
                  {attempt.errorMessage ? <div>error: {attempt.errorMessage}</div> : null}
                  {attempt.sessions.length > 0 ? (
                    <ul className="m-0 list-disc space-y-1 pl-5">
                      {attempt.sessions.map((session) => (
                        <li key={session.sessionId}>
                          session {session.sessionId} [{session.runtimeKind}] {session.status} started{" "}
                          {new Date(session.startedAt).toLocaleString()} finished{" "}
                          {session.finishedAt
                            ? new Date(session.finishedAt).toLocaleString()
                            : "running"}
                          {session.sessionRef ? ` ref=${session.sessionRef}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>Select an issue to inspect attempts.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

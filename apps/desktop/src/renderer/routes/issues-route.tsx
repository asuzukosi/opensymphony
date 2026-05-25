import React, { useEffect, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symphony/ui";
import type { IssueRunHistory, OrchestratorIssueQueues } from "@/ipc";

const POLL_INTERVAL_MS = 5000;

function getDesktopApi() {
  return (
    window as Window & {
      symphonyDesktop?: {
        getOrchestratorIssueQueues?: () => Promise<OrchestratorIssueQueues>;
        getIssueRunHistory?: (issueId: string, limit?: number) => Promise<IssueRunHistory>;
      };
    }
  ).symphonyDesktop;
}

export function IssuesRoute(): React.JSX.Element {
  const [queues, setQueues] = useState<OrchestratorIssueQueues | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<IssueRunHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchQueues = async (): Promise<void> => {
      const api = getDesktopApi();
      if (!api?.getOrchestratorIssueQueues) {
        if (mounted) {
          setError("Desktop API unavailable");
          setLoading(false);
        }
        return;
      }

      try {
        const data = await api.getOrchestratorIssueQueues();
        if (!mounted) return;
        setQueues(data);
        setError(null);
      } catch (fetchError) {
        if (!mounted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load issue queues");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchQueues();
    const interval = setInterval(() => {
      void fetchQueues();
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const loadHistory = async (issueId: string): Promise<void> => {
    const api = getDesktopApi();
    if (!api?.getIssueRunHistory) return;
    setHistoryLoading(true);
    try {
      const data = await api.getIssueRunHistory(issueId, 10);
      setRunHistory(data);
    } catch {
      setRunHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!selectedIssueId) {
      setRunHistory(null);
      return;
    }

    const pull = async (): Promise<void> => {
      if (!mounted) return;
      await loadHistory(selectedIssueId);
    };

    void pull();
    const interval = setInterval(() => {
      void pull();
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedIssueId]);

  if (loading) return <Card><CardContent className="pt-6">Loading issue queues...</CardContent></Card>;
  if (error) return <Card><CardContent className="pt-6">Issue queue error: {error}</CardContent></Card>;
  if (!queues) return <Card><CardContent className="pt-6">No queue data available.</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Issue Queues</CardTitle>
        <CardDescription>Running attempts, retries, candidates, and per-issue run history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
      <section className="space-y-2">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Running ({queues.running.length})</h3>
      <ul className="symphony-list space-y-1">
        {queues.running.map((item) => (
          <li
            key={item.runAttemptId}
            onClick={() => setSelectedIssueId(item.issueId)}
            style={{ cursor: "pointer" }}
          >
            {item.issueId} attempt #{item.attemptNumber}
          </li>
        ))}
      </ul>
      </section>
      <section className="space-y-2">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Retry Queue ({queues.retryQueue.length})</h3>
      <ul className="symphony-list space-y-1">
        {queues.retryQueue.map((item) => (
          <li
            key={item.issueId}
            onClick={() => setSelectedIssueId(item.issueId)}
            style={{ cursor: "pointer" }}
          >
            {item.issueId} attempt #{item.attemptNumber} due {new Date(item.dueAt).toLocaleString()}
          </li>
        ))}
      </ul>
      </section>
      <section className="space-y-2">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Candidates ({queues.candidates.length})</h3>
      <ul className="symphony-list space-y-1">
        {queues.candidates.map((item) => (
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
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Run History {selectedIssueId ? `(${selectedIssueId})` : ""}</h3>
      {selectedIssueId ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => void loadHistory(selectedIssueId)}
          disabled={historyLoading}
        >
          {historyLoading ? "Refreshing..." : "Refresh History"}
        </Button>
      ) : null}
      {runHistory ? (
        <ul className="symphony-list space-y-3">
          {runHistory.attempts.map((attempt) => (
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
                <ul className="symphony-list space-y-1">
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

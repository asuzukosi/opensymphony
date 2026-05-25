import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symphony/ui";
import type { OrchestratorAuditEvent, OrchestratorSnapshot } from "@/ipc";

const POLL_INTERVAL_MS = 5000;

function getDesktopApi() {
  return (
    window as Window & {
      symphonyDesktop?: {
        getOrchestratorSnapshot?: () => Promise<OrchestratorSnapshot>;
        getRecentAuditEvents?: (limit?: number) => Promise<OrchestratorAuditEvent[]>;
      };
    }
  ).symphonyDesktop;
}

export function DashboardRoute(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<OrchestratorSnapshot | null>(null);
  const [events, setEvents] = useState<OrchestratorAuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchSnapshot = async (): Promise<void> => {
      const api = getDesktopApi();
      if (!api?.getOrchestratorSnapshot) {
        if (mounted) {
          setError("Desktop API unavailable");
          setLoading(false);
        }
        return;
      }

      try {
        const data = await api.getOrchestratorSnapshot();
        const recentEvents = api.getRecentAuditEvents ? await api.getRecentAuditEvents(10) : [];
        if (!mounted) return;
        setSnapshot(data);
        setEvents(recentEvents);
        setError(null);
      } catch (fetchError) {
        if (!mounted) return;
        setError(
          fetchError instanceof Error ? fetchError.message : "Failed to load orchestrator snapshot",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchSnapshot();
    const interval = setInterval(() => {
      void fetchSnapshot();
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

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

  if (loading) return <Card><CardContent className="pt-6">Loading orchestrator snapshot...</CardContent></Card>;
  if (error) return <Card><CardContent className="pt-6">Orchestrator error: {error}</CardContent></Card>;
  if (!snapshot) return <Card><CardContent className="pt-6">No orchestrator data available.</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orchestrator Dashboard</CardTitle>
        <CardDescription>Live runtime snapshot and recent orchestration events.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="symphony-kv-grid">
          <p>Status: {snapshot.status}</p>
          <p>Runtime Adapter: {snapshot.runtimeAdapterKind}</p>
          <p>Workflow Path: {snapshot.workflowPath}</p>
          <p>Workflow Version: {snapshot.workflowVersion ?? "n/a"}</p>
          <p>
            Workflow Reloaded:{" "}
            {snapshot.workflowLastReloadedAt
              ? new Date(snapshot.workflowLastReloadedAt).toLocaleString()
              : "n/a"}
          </p>
          <p>Started At: {startedAt}</p>
          <p>Poll Interval: {snapshot.pollIntervalMs} ms</p>
          <p>Next Tick: {nextTickAt}</p>
          <p>Last Tick: {lastTick}</p>
          <p>Total Ticks: {snapshot.tickCount}</p>
          <p>Last Dispatched: {snapshot.lastDispatchedCount}</p>
          <p>Last Deferred: {snapshot.lastDeferredCount}</p>
          <p>Last Cancelled: {snapshot.lastCancelledCount}</p>
          <p>Last Action: {snapshot.lastAction ?? "n/a"}</p>
          <p>Last Error: {snapshot.lastError ?? "none"}</p>
        </div>
        <h4 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Recent Events</h4>
        <ul className="symphony-list">
          {events.map((event, index) => (
            <li key={`${event.createdAt}-${index}`}>
              {new Date(event.createdAt).toLocaleTimeString()} {event.action}
              {event.issueId ? ` (${event.issueId})` : ""}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

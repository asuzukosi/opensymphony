import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symphony/ui";
import { useRuntimeState } from "@/renderer/hooks/use-runtime-state";

export function Dashboard(): React.JSX.Element {
  const { snapshot, error, isLoading } = useRuntimeState();
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
    return (
      <Card>
        <CardContent className="pt-6">Loading orchestrator snapshot...</CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">Orchestrator error: {error.message}</CardContent>
      </Card>
    );
  }
  if (!snapshot) {
    return (
      <Card>
        <CardContent className="pt-6">No orchestrator data available.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orchestrator Dashboard</CardTitle>
        <CardDescription>Live runtime snapshot and recent orchestration events.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-4 gap-y-2 [&_p]:m-0">
          <p>Status: {snapshot.status}</p>
          <p>Runtime Adapter: {snapshot.runtimeAdapterKind}</p>
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
        <h4 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Recent Events
        </h4>
        <ul className="m-0 list-disc pl-5">
          {recentEvents.map((event, index) => (
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

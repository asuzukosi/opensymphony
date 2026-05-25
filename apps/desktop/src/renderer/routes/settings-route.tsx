import React, { useEffect, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@symphony/ui";
import type { OrchestratorSnapshot } from "@/ipc";

const POLL_INTERVAL_MS = 5000;

function getDesktopApi() {
  return (
    window as Window & {
      symphonyDesktop?: {
        getOrchestratorSnapshot?: () => Promise<OrchestratorSnapshot>;
        startOrchestratorRuntime?: () => Promise<OrchestratorSnapshot>;
        stopOrchestratorRuntime?: () => Promise<OrchestratorSnapshot>;
        runOrchestratorTick?: () => Promise<OrchestratorSnapshot>;
        setOrchestratorPollIntervalMs?: (pollIntervalMs: number) => Promise<OrchestratorSnapshot>;
        clearOrchestratorPollIntervalOverride?: () => Promise<OrchestratorSnapshot>;
      };
    }
  ).symphonyDesktop;
}

export function SettingsRoute(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<OrchestratorSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollIntervalInput, setPollIntervalInput] = useState("30000");

  useEffect(() => {
    let mounted = true;
    const api = getDesktopApi();

    const fetchSnapshot = async (): Promise<void> => {
      if (!api?.getOrchestratorSnapshot) return;
      try {
        const data = await api.getOrchestratorSnapshot();
        if (!mounted) return;
        setSnapshot(data);
        setPollIntervalInput(String(data.pollIntervalMs));
      } catch (fetchError) {
        if (!mounted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load runtime state");
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

  const runAction = async (
    action: (api: NonNullable<ReturnType<typeof getDesktopApi>>) => Promise<OrchestratorSnapshot>,
  ): Promise<void> => {
    const api = getDesktopApi();
    if (!api) {
      setError("Desktop API unavailable");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const next = await action(api);
      setSnapshot(next);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Runtime Controls</CardTitle>
        <CardDescription>Control orchestration execution and polling cadence.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="symphony-kv-grid">
          <p>Current status: {snapshot?.status ?? "unknown"}</p>
          <p>
            Started at:{" "}
            {snapshot?.startedAt ? new Date(snapshot.startedAt).toLocaleString() : "Not started"}
          </p>
          <p>Poll interval: {snapshot?.pollIntervalMs ?? 0} ms</p>
          <p>Poll interval source: {snapshot?.pollIntervalSource ?? "workflow"}</p>
          <p>
            Next tick:{" "}
            {snapshot?.nextTickAt ? new Date(snapshot.nextTickAt).toLocaleString() : "n/a"}
          </p>
          <p>Total ticks: {snapshot?.tickCount ?? 0}</p>
          <p>
            Last tick:{" "}
            {snapshot?.lastTickAt ? new Date(snapshot.lastTickAt).toLocaleString() : "Never"}
          </p>
          <p>Last action: {snapshot?.lastAction ?? "n/a"}</p>
          <p>Last runtime error: {snapshot?.lastError ?? "none"}</p>
        </div>
        {error ? <p className="text-sm text-red-400">Settings error: {error}</p> : null}
        <div className="symphony-inline-row">
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            runAction(
              (api) => api.startOrchestratorRuntime?.() ?? Promise.reject(new Error("Missing API")),
            )
          }
        >
          Start Runtime
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            runAction(
              (api) => api.stopOrchestratorRuntime?.() ?? Promise.reject(new Error("Missing API")),
            )
          }
        >
          Stop Runtime
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            runAction(
              (api) => api.runOrchestratorTick?.() ?? Promise.reject(new Error("Missing API")),
            )
          }
        >
          Run Tick Now
        </Button>
        </div>
        <div className="symphony-inline-row">
        <label htmlFor="poll-interval-input">Poll interval (ms)</label>
        <Input
          id="poll-interval-input"
          type="number"
          min={1000}
          step={1000}
          value={pollIntervalInput}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setPollIntervalInput(event.target.value)
          }
          disabled={busy}
        />
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            runAction((api) => {
              const parsed = Number.parseInt(pollIntervalInput, 10);
              if (!Number.isFinite(parsed))
                return Promise.reject(new Error("Poll interval must be a number"));
              return (
                api.setOrchestratorPollIntervalMs?.(parsed) ??
                Promise.reject(new Error("Missing API"))
              );
            })
          }
        >
          Apply Interval
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            runAction(
              (api) =>
                api.clearOrchestratorPollIntervalOverride?.() ??
                Promise.reject(new Error("Missing API")),
            )
          }
        >
          Reset To Workflow Default
        </Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";

import { PanelSection } from "@/components/layout/panel-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { UseRuntimeResult } from "@/hooks/use-runtime";
import { formatDateTime } from "@/lib/format-date-time";
import { isPendingLoad } from "@/lib/is-pending-load";

type RuntimePanelProps = {
  projectId: string | null;
  runtime: UseRuntimeResult;
};

function SnapshotField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function RuntimePanel({ projectId, runtime }: RuntimePanelProps) {
  const {
    summary,
    fetchedAt,
    isLoading,
    startRuntime,
    stopRuntime,
    tickRuntime,
    setRuntimePollInterval,
    clearRuntimePollIntervalOverride,
    isControlling,
    controlError,
    resetControl,
  } = runtime;

  const pending = isPendingLoad(isLoading, summary);
  const controlsDisabled = isControlling || pending || projectId == null;
  const [pollIntervalInput, setPollIntervalInput] = useState("");
  const [pollIntervalError, setPollIntervalError] = useState<string | null>(null);

  useEffect(() => {
    if (summary?.pollIntervalMs != null) {
      setPollIntervalInput(String(summary.pollIntervalMs));
    }
  }, [summary?.pollIntervalMs]);

  const runControl = async (action: () => Promise<void>): Promise<void> => {
    resetControl();
    try {
      await action();
    } catch {
      // surfaced via controlError
    }
  };

  if (pending) {
    return (
      <PanelSection title="Runtime snapshot" description="Poll cadence and orchestrator controls.">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-9 w-full max-w-md" />
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Runtime snapshot" description="Poll cadence, tick counters, and orchestrator controls.">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SnapshotField
          label="Poll interval"
          value={
            summary?.pollIntervalMs != null ? (
              <span className="font-mono tabular-nums">{summary.pollIntervalMs} ms</span>
            ) : (
              "—"
            )
          }
        />
        <SnapshotField label="Last tick" value={formatDateTime(summary?.lastTickAt, "Never")} />
        <SnapshotField label="Next tick" value={formatDateTime(summary?.nextTickAt, "n/a")} />
        <SnapshotField
          label="Total ticks"
          value={
            summary?.tickCount != null ? (
              <span className="font-mono tabular-nums">{summary.tickCount}</span>
            ) : (
              "—"
            )
          }
        />
        <SnapshotField
          label="Last dispatched"
          value={
            summary?.lastDispatchedCount != null ? (
              <span className="font-mono tabular-nums">{summary.lastDispatchedCount}</span>
            ) : (
              "—"
            )
          }
        />
        <SnapshotField label="Last action" value={summary?.lastAction ?? "n/a"} />
        <SnapshotField
          label="Last error"
          value={
            summary?.lastError ? <span className="text-destructive">{summary.lastError}</span> : "none"
          }
        />
        <SnapshotField label="Fetched at" value={formatDateTime(fetchedAt, "n/a")} />
      </dl>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-normal">Controls</h4>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={controlsDisabled} onClick={() => void runControl(startRuntime)}>
            Start
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={controlsDisabled} onClick={() => void runControl(stopRuntime)}>
            Stop
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={controlsDisabled} onClick={() => void runControl(tickRuntime)}>
            Tick
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-normal">Poll interval override</h4>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-2">
            <Label htmlFor="runtime-poll-interval">Interval (ms)</Label>
            <Input
              id="runtime-poll-interval"
              type="number"
              min={1000}
              step={1000}
              value={pollIntervalInput}
              onChange={(event) => setPollIntervalInput(event.target.value)}
              disabled={controlsDisabled}
              className="w-40"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={controlsDisabled}
            onClick={() => {
              resetControl();
              const parsed = Number.parseInt(pollIntervalInput, 10);
              if (!Number.isFinite(parsed) || parsed < 1000) {
                setPollIntervalError("Poll interval must be at least 1000 ms");
                return;
              }
              setPollIntervalError(null);
              void runControl(() => setRuntimePollInterval(parsed));
            }}
          >
            {isControlling ? "Applying..." : "Apply"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={controlsDisabled}
            onClick={() => {
              setPollIntervalError(null);
              void runControl(clearRuntimePollIntervalOverride);
            }}
          >
            Reset override
          </Button>
        </div>
        {pollIntervalError ? <p className="text-sm text-destructive">{pollIntervalError}</p> : null}
      </div>

      {controlError ? (
        <Alert variant="destructive">
          <AlertTitle>Runtime control failed</AlertTitle>
          <AlertDescription>{controlError.message}</AlertDescription>
        </Alert>
      ) : null}
    </PanelSection>
  );
}

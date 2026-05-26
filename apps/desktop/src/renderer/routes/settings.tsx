import React, { useEffect, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@symphony/ui";
import { useRuntimeControls } from "@/renderer/hooks/use-runtime-controls";
import { useSettings } from "@/renderer/hooks/use-settings";

export function Settings(): React.JSX.Element {
  const { settings, error: settingsError, isLoading, refetch } = useSettings();
  const {
    start,
    stop,
    tick,
    setPollInterval,
    clearPollIntervalOverride,
    isPending,
    error: controlsError,
    reset: resetControls,
  } = useRuntimeControls();
  const [pollIntervalInput, setPollIntervalInput] = useState("30000");
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setPollIntervalInput(String(settings.pollIntervalMs));
    }
  }, [settings?.pollIntervalMs]);

  const runControl = async (action: () => Promise<unknown>): Promise<void> => {
    setInputError(null);
    resetControls();
    try {
      await action();
      await refetch();
    } catch {
      // mutation errors are exposed via controlsError
    }
  };

  const errorMessage =
    inputError ?? settingsError?.message ?? controlsError?.message ?? null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">Loading runtime settings...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Runtime Controls</CardTitle>
        <CardDescription>Control orchestration execution and polling cadence.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-4 gap-y-2 [&_p]:m-0">
          <p>Current status: {settings?.status ?? "unknown"}</p>
          <p>
            Started at:{" "}
            {settings?.startedAt ? new Date(settings.startedAt).toLocaleString() : "Not started"}
          </p>
          <p>Poll interval: {settings?.pollIntervalMs ?? 0} ms</p>
          <p>Poll interval source: {settings?.pollIntervalSource ?? "workflow"}</p>
          <p>
            Next tick:{" "}
            {settings?.nextTickAt ? new Date(settings.nextTickAt).toLocaleString() : "n/a"}
          </p>
          <p>Total ticks: {settings?.tickCount ?? 0}</p>
          <p>
            Last tick:{" "}
            {settings?.lastTickAt ? new Date(settings.lastTickAt).toLocaleString() : "Never"}
          </p>
          <p>Last action: {settings?.lastAction ?? "n/a"}</p>
          <p>Last runtime error: {settings?.lastError ?? "none"}</p>
        </div>
        {errorMessage ? <p className="text-sm text-red-400">Settings error: {errorMessage}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={isPending} onClick={() => void runControl(start)}>
            Start Runtime
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => void runControl(stop)}
          >
            Stop Runtime
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => void runControl(tick)}
          >
            Run Tick Now
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            disabled={isPending}
          />
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              const parsed = Number.parseInt(pollIntervalInput, 10);
              if (!Number.isFinite(parsed)) {
                setInputError("Poll interval must be a number");
                return;
              }
              void runControl(() => setPollInterval(parsed));
            }}
          >
            Apply Interval
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => void runControl(clearPollIntervalOverride)}
          >
            Reset To Workflow Default
          </Button>
        </div>
        <div className="space-y-2 border-t border-border pt-4">
          <Label htmlFor="workflow-path-input" className="text-xs text-muted-foreground">
            Workflow path
          </Label>
          <Input
            id="workflow-path-input"
            type="text"
            value={settings?.workflowPath ?? ""}
            placeholder="path/to/WORKFLOW.md"
            className="font-mono text-xs text-muted-foreground"
            disabled={isPending}
            readOnly
          />
        </div>
      </CardContent>
    </Card>
  );
}

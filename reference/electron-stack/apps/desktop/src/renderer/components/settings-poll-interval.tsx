import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Input, Label } from "@symphony/ui";
import type { PollIntervalSource } from "@/ipc";

type SettingsPollIntervalProps = {
  pollIntervalMs: number;
  pollIntervalSource: PollIntervalSource;
  onApply: (pollIntervalMs: number) => Promise<void>;
  onReset: () => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function SettingsPollInterval({
  pollIntervalMs,
  pollIntervalSource,
  onApply,
  onReset,
  isPending = false,
  submitError = null,
}: SettingsPollIntervalProps): React.JSX.Element {
  const [pollIntervalInput, setPollIntervalInput] = useState(String(pollIntervalMs));
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    setPollIntervalInput(String(pollIntervalMs));
  }, [pollIntervalMs]);

  const handleApply = async (): Promise<void> => {
    const parsed = Number.parseInt(pollIntervalInput, 10);
    if (!Number.isFinite(parsed)) {
      setInputError("Poll interval must be a number");
      return;
    }
    if (parsed < 1000) {
      setInputError("Poll interval must be at least 1000 ms");
      return;
    }

    setInputError(null);
    try {
      await onApply(parsed);
    } catch {
      // surfaced via submitError
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Poll interval</h3>
        <p className="text-sm text-muted-foreground">
          Current source: {pollIntervalSource}. Override cadence or reset to workflow default.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-2">
          <Label htmlFor="poll-interval-input">Poll interval (ms)</Label>
          <Input
            id="poll-interval-input"
            type="number"
            min={1000}
            step={1000}
            value={pollIntervalInput}
            onChange={(event) => setPollIntervalInput(event.target.value)}
            disabled={isPending}
            className="w-40"
          />
        </div>
        <Button type="button" disabled={isPending} onClick={() => void handleApply()}>
          {isPending ? "Applying..." : "Apply interval"}
        </Button>
        <Button type="button" variant="ghost" disabled={isPending} onClick={() => void onReset()}>
          Reset to workflow default
        </Button>
      </div>
      {inputError ? <p className="text-sm text-red-400">{inputError}</p> : null}
      {submitError ? (
        <Alert variant="destructive">
          <AlertTitle>Poll interval update failed</AlertTitle>
          <AlertDescription>{submitError.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

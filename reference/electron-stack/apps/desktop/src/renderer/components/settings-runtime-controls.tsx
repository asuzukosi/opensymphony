import React from "react";
import { Alert, AlertDescription, AlertTitle, Button } from "@symphony/ui";

type SettingsRuntimeControlsProps = {
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onTick: () => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function SettingsRuntimeControls({
  onStart,
  onStop,
  onTick,
  isPending = false,
  submitError = null,
}: SettingsRuntimeControlsProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Orchestrator controls</h3>
        <p className="text-sm text-muted-foreground">
          Start, stop, or manually trigger a poll tick.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={isPending} onClick={() => void onStart()}>
          {isPending ? "Working..." : "Start runtime"}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => void onStop()}>
          Stop runtime
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={() => void onTick()}>
          Run tick
        </Button>
      </div>
      {submitError ? (
        <Alert variant="destructive">
          <AlertTitle>Runtime control failed</AlertTitle>
          <AlertDescription>{submitError.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

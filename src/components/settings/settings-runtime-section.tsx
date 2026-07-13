"use client";

import { useEffect, useState } from "react";

import { FormRow } from "@/components/layout/form-row";
import { SurfaceCard } from "@/components/layout/surface-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RetryPolicy } from "@/lib/ipc/types";
import { backoffMsToSeconds, backoffSecondsToMs } from "@/lib/retry-backoff";

type SettingsRuntimeSectionProps = {
  maxConcurrency: number;
  retryPolicy: RetryPolicy;
  onSaveMaxConcurrency: (maxConcurrency: number) => Promise<void>;
  onSaveRetryPolicy: (maxAttempts: number, backoffMs: number) => Promise<void>;
  isPending?: boolean;
  maxConcurrencyError?: Error | null;
  retryPolicyError?: Error | null;
};

function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < 0) {
    return null;
  }
  return parsed;
}

export function SettingsRuntimeSection({
  maxConcurrency,
  retryPolicy,
  onSaveMaxConcurrency,
  onSaveRetryPolicy,
  isPending = false,
  maxConcurrencyError = null,
  retryPolicyError = null,
}: SettingsRuntimeSectionProps) {
  const [maxConcurrencyInput, setMaxConcurrencyInput] = useState(String(maxConcurrency));
  const [maxAttemptsInput, setMaxAttemptsInput] = useState(String(retryPolicy.maxAttempts));
  const [backoffSecondsInput, setBackoffSecondsInput] = useState(
    String(backoffMsToSeconds(retryPolicy.backoffMs)),
  );
  const [maxConcurrencyInputError, setMaxConcurrencyInputError] = useState<string | null>(null);
  const [retryPolicyInputError, setRetryPolicyInputError] = useState<string | null>(null);

  useEffect(() => {
    setMaxConcurrencyInput(String(maxConcurrency));
  }, [maxConcurrency]);

  useEffect(() => {
    setMaxAttemptsInput(String(retryPolicy.maxAttempts));
    setBackoffSecondsInput(String(backoffMsToSeconds(retryPolicy.backoffMs)));
  }, [retryPolicy.backoffMs, retryPolicy.maxAttempts]);

  const maxConcurrencyDirty = Number.parseInt(maxConcurrencyInput, 10) !== maxConcurrency;
  const retryPolicyDirty =
    Number.parseInt(maxAttemptsInput, 10) !== retryPolicy.maxAttempts ||
    Number.parseInt(backoffSecondsInput, 10) !== backoffMsToSeconds(retryPolicy.backoffMs);

  const handleSaveMaxConcurrency = async (): Promise<void> => {
    const parsed = parsePositiveInt(maxConcurrencyInput);
    if (parsed == null || parsed < 1) {
      setMaxConcurrencyInputError("Max concurrency must be at least 1");
      return;
    }

    setMaxConcurrencyInputError(null);
    try {
      await onSaveMaxConcurrency(parsed);
    } catch {
      // api error surfaced via maxConcurrencyError
    }
  };

  const handleSaveRetryPolicy = async (): Promise<void> => {
    const maxAttempts = parsePositiveInt(maxAttemptsInput);
    const backoffSeconds = parsePositiveInt(backoffSecondsInput);
    if (maxAttempts == null || maxAttempts < 1) {
      setRetryPolicyInputError("Max attempts must be at least 1");
      return;
    }
    if (backoffSeconds == null) {
      setRetryPolicyInputError("Backoff must be a number of seconds");
      return;
    }

    setRetryPolicyInputError(null);
    try {
      await onSaveRetryPolicy(maxAttempts, backoffSecondsToMs(backoffSeconds));
    } catch {
      // api error surfaced via retryPolicyError
    }
  };

  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle id="settings-runtime-title" className="text-sm">
          <span className="text-sm">Runtime</span>
        </CardTitle>
        <CardDescription className="text-xs">
          Concurrency limits and retry behavior for this project.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <FormRow
            label="Max concurrency"
            description="Maximum number of agent runs dispatched at once."
            htmlFor="max-concurrency"
          >
            <Input
              id="max-concurrency"
              type="number"
              min={1}
              step={1}
              value={maxConcurrencyInput}
              onChange={(event) => setMaxConcurrencyInput(event.target.value)}
              disabled={isPending}
              className="font-mono tabular-nums"
            />
          </FormRow>
          {maxConcurrencyInputError ? (
            <p className="text-sm text-destructive">{maxConcurrencyInputError}</p>
          ) : null}
          {maxConcurrencyError ? (
            <Alert variant="destructive">
              <AlertTitle>Max concurrency update failed</AlertTitle>
              <AlertDescription>{maxConcurrencyError.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={isPending || !maxConcurrencyDirty}
              onClick={() => void handleSaveMaxConcurrency()}
            >
              {isPending ? "Saving..." : "Save max concurrency"}
            </Button>
          </div>
        </div>

        <div className="space-y-4 border-t border-border/60 pt-6">
          <FormRow label="Retry policy" description="How failed run attempts are retried.">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="retry-max-attempts" className="text-xs">
                  Max attempts
                </Label>
                <Input
                  id="retry-max-attempts"
                  type="number"
                  min={1}
                  step={1}
                  value={maxAttemptsInput}
                  onChange={(event) => setMaxAttemptsInput(event.target.value)}
                  disabled={isPending}
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="retry-backoff-seconds" className="text-xs">
                  Backoff (seconds)
                </Label>
                <Input
                  id="retry-backoff-seconds"
                  type="number"
                  min={0}
                  step={1}
                  value={backoffSecondsInput}
                  onChange={(event) => setBackoffSecondsInput(event.target.value)}
                  disabled={isPending}
                  className="font-mono tabular-nums"
                />
              </div>
            </div>
          </FormRow>
          {retryPolicyInputError ? (
            <p className="text-sm text-destructive">{retryPolicyInputError}</p>
          ) : null}
          {retryPolicyError ? (
            <Alert variant="destructive">
              <AlertTitle>Retry policy update failed</AlertTitle>
              <AlertDescription>{retryPolicyError.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={isPending || !retryPolicyDirty}
              onClick={() => void handleSaveRetryPolicy()}
            >
              {isPending ? "Saving..." : "Save retry policy"}
            </Button>
          </div>
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

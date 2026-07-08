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

type SettingsRuntimeSectionProps = {
  pollIntervalMs: number;
  maxConcurrency: number;
  retryPolicy: RetryPolicy;
  onSavePollInterval: (pollIntervalMs: number) => Promise<void>;
  onSaveMaxConcurrency: (maxConcurrency: number) => Promise<void>;
  onSaveRetryPolicy: (maxAttempts: number, backoffMs: number) => Promise<void>;
  isPending?: boolean;
  pollIntervalError?: Error | null;
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
  pollIntervalMs,
  maxConcurrency,
  retryPolicy,
  onSavePollInterval,
  onSaveMaxConcurrency,
  onSaveRetryPolicy,
  isPending = false,
  pollIntervalError = null,
  maxConcurrencyError = null,
  retryPolicyError = null,
}: SettingsRuntimeSectionProps) {
  const [pollIntervalInput, setPollIntervalInput] = useState(String(pollIntervalMs));
  const [maxConcurrencyInput, setMaxConcurrencyInput] = useState(String(maxConcurrency));
  const [maxAttemptsInput, setMaxAttemptsInput] = useState(String(retryPolicy.maxAttempts));
  const [backoffMsInput, setBackoffMsInput] = useState(String(retryPolicy.backoffMs));
  const [pollIntervalInputError, setPollIntervalInputError] = useState<string | null>(null);
  const [maxConcurrencyInputError, setMaxConcurrencyInputError] = useState<string | null>(null);
  const [retryPolicyInputError, setRetryPolicyInputError] = useState<string | null>(null);

  useEffect(() => {
    setPollIntervalInput(String(pollIntervalMs));
  }, [pollIntervalMs]);

  useEffect(() => {
    setMaxConcurrencyInput(String(maxConcurrency));
  }, [maxConcurrency]);

  useEffect(() => {
    setMaxAttemptsInput(String(retryPolicy.maxAttempts));
    setBackoffMsInput(String(retryPolicy.backoffMs));
  }, [retryPolicy.backoffMs, retryPolicy.maxAttempts]);

  const pollIntervalDirty = Number.parseInt(pollIntervalInput, 10) !== pollIntervalMs;
  const maxConcurrencyDirty = Number.parseInt(maxConcurrencyInput, 10) !== maxConcurrency;
  const retryPolicyDirty =
    Number.parseInt(maxAttemptsInput, 10) !== retryPolicy.maxAttempts ||
    Number.parseInt(backoffMsInput, 10) !== retryPolicy.backoffMs;

  const handleSavePollInterval = async (): Promise<void> => {
    const parsed = parsePositiveInt(pollIntervalInput);
    if (parsed == null) {
      setPollIntervalInputError("Poll interval must be a number");
      return;
    }
    if (parsed < 1000) {
      setPollIntervalInputError("Poll interval must be at least 1000 ms");
      return;
    }

    setPollIntervalInputError(null);
    try {
      await onSavePollInterval(parsed);
    } catch {
      // api error surfaced via pollIntervalError
    }
  };

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
    const backoffMs = parsePositiveInt(backoffMsInput);
    if (maxAttempts == null || maxAttempts < 1) {
      setRetryPolicyInputError("Max attempts must be at least 1");
      return;
    }
    if (backoffMs == null) {
      setRetryPolicyInputError("Backoff must be a number");
      return;
    }

    setRetryPolicyInputError(null);
    try {
      await onSaveRetryPolicy(maxAttempts, backoffMs);
    } catch {
      // api error surfaced via retryPolicyError
    }
  };

  return (
    <section id="runtime" aria-labelledby="settings-runtime-title">
      <SurfaceCard>
        <CardHeader className="pb-4">
          <CardTitle id="settings-runtime-title" className="text-base">
            Runtime
          </CardTitle>
          <CardDescription>
            Orchestrator poll cadence, concurrency limits, and retry behavior for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <FormRow
              label="Poll interval"
              description="How often the orchestrator checks for new work."
              htmlFor="poll-interval-ms"
            >
              <Input
                id="poll-interval-ms"
                type="number"
                min={1000}
                step={1000}
                value={pollIntervalInput}
                onChange={(event) => setPollIntervalInput(event.target.value)}
                disabled={isPending}
                className="font-mono tabular-nums"
              />
            </FormRow>
            {pollIntervalInputError ? (
              <p className="text-sm text-destructive">{pollIntervalInputError}</p>
            ) : null}
            {pollIntervalError ? (
              <Alert variant="destructive">
                <AlertTitle>Poll interval update failed</AlertTitle>
                <AlertDescription>{pollIntervalError.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={isPending || !pollIntervalDirty}
                onClick={() => void handleSavePollInterval()}
              >
                {isPending ? "Saving..." : "Save poll interval"}
              </Button>
            </div>
          </div>

          <div className="space-y-4 border-t border-border/60 pt-6">
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
            <FormRow
              label="Retry policy"
              description="How failed run attempts are retried."
            >
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="retry-max-attempts">Max attempts</Label>
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
                  <Label htmlFor="retry-backoff-ms">Backoff (ms)</Label>
                  <Input
                    id="retry-backoff-ms"
                    type="number"
                    min={0}
                    step={1000}
                    value={backoffMsInput}
                    onChange={(event) => setBackoffMsInput(event.target.value)}
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
    </section>
  );
}

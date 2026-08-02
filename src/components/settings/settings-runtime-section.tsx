"use client";

import { useEffect, useState } from "react";

import { FormRow } from "@/components/layout/form-row";
import { SurfaceCard } from "@/components/layout/surface-card";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function SettingsRuntimeSection({
  maxConcurrency,
  retryPolicy,
  onSaveMaxConcurrency,
  onSaveRetryPolicy,
  isPending = false,
  maxConcurrencyError = null,
  retryPolicyError = null,
}: SettingsRuntimeSectionProps) {
  const [maxConcurrencyValue, setMaxConcurrencyValue] = useState(maxConcurrency);
  const [maxAttemptsValue, setMaxAttemptsValue] = useState(retryPolicy.maxAttempts);
  const [backoffSecondsValue, setBackoffSecondsValue] = useState(
    backoffMsToSeconds(retryPolicy.backoffMs),
  );
  const [maxConcurrencyInputError, setMaxConcurrencyInputError] = useState<string | null>(null);
  const [retryPolicyInputError, setRetryPolicyInputError] = useState<string | null>(null);

  useEffect(() => {
    setMaxConcurrencyValue(maxConcurrency);
  }, [maxConcurrency]);

  useEffect(() => {
    setMaxAttemptsValue(retryPolicy.maxAttempts);
    setBackoffSecondsValue(backoffMsToSeconds(retryPolicy.backoffMs));
  }, [retryPolicy.backoffMs, retryPolicy.maxAttempts]);

  const maxConcurrencyDirty = maxConcurrencyValue !== maxConcurrency;
  const retryPolicyDirty =
    maxAttemptsValue !== retryPolicy.maxAttempts ||
    backoffSecondsValue !== backoffMsToSeconds(retryPolicy.backoffMs);

  const handleSaveMaxConcurrency = async (): Promise<void> => {
    if (maxConcurrencyValue < 1) {
      setMaxConcurrencyInputError("Max concurrency must be at least 1");
      return;
    }

    setMaxConcurrencyInputError(null);
    try {
      await onSaveMaxConcurrency(maxConcurrencyValue);
    } catch {
      // api error surfaced via maxConcurrencyError
    }
  };

  const handleSaveRetryPolicy = async (): Promise<void> => {
    if (maxAttemptsValue < 1) {
      setRetryPolicyInputError("Max attempts must be at least 1");
      return;
    }

    setRetryPolicyInputError(null);
    try {
      await onSaveRetryPolicy(maxAttemptsValue, backoffSecondsToMs(backoffSecondsValue));
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
            <NumberField
              id="max-concurrency"
              value={maxConcurrencyValue}
              min={1}
              disabled={isPending}
              onValueChange={(next) => {
                if (next != null) {
                  setMaxConcurrencyValue(next);
                }
              }}
            >
              <NumberFieldGroup>
                <NumberFieldDecrement />
                <NumberFieldInput className="font-mono" />
                <NumberFieldIncrement />
              </NumberFieldGroup>
            </NumberField>
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
                <NumberField
                  id="retry-max-attempts"
                  value={maxAttemptsValue}
                  min={1}
                  disabled={isPending}
                  onValueChange={(next) => {
                    if (next != null) {
                      setMaxAttemptsValue(next);
                    }
                  }}
                >
                  <NumberFieldGroup>
                    <NumberFieldDecrement />
                    <NumberFieldInput className="font-mono" />
                    <NumberFieldIncrement />
                  </NumberFieldGroup>
                </NumberField>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="retry-backoff-seconds" className="text-xs">
                  Backoff (seconds)
                </Label>
                <NumberField
                  id="retry-backoff-seconds"
                  value={backoffSecondsValue}
                  min={0}
                  disabled={isPending}
                  onValueChange={(next) => {
                    if (next != null) {
                      setBackoffSecondsValue(next);
                    }
                  }}
                >
                  <NumberFieldGroup>
                    <NumberFieldDecrement />
                    <NumberFieldInput className="font-mono" />
                    <NumberFieldIncrement />
                  </NumberFieldGroup>
                </NumberField>
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

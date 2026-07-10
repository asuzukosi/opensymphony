"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectRuntimeFields } from "@/lib/create-project-form";

type RuntimeFieldsProps = {
  value: ProjectRuntimeFields;
  onChange: (value: ProjectRuntimeFields) => void;
  disabled?: boolean;
};

export function RuntimeFields({ value, onChange, disabled = false }: RuntimeFieldsProps) {
  const update = (patch: Partial<ProjectRuntimeFields>): void => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="grid gap-3">
      <Label>Runtime</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="project-poll-interval" className="text-xs font-normal text-muted-foreground">
            Poll interval (ms)
          </Label>
          <Input
            id="project-poll-interval"
            type="number"
            min={1000}
            step={1000}
            value={value.pollIntervalMs}
            onChange={(event) => update({ pollIntervalMs: Number(event.target.value) })}
            disabled={disabled}
            className="text-xs"
          />
        </div>
        <div className="grid gap-2">
          <Label
            htmlFor="project-max-concurrency"
            className="text-xs font-normal text-muted-foreground"
          >
            Max concurrency
          </Label>
          <Input
            id="project-max-concurrency"
            type="number"
            min={1}
            step={1}
            value={value.maxConcurrency}
            onChange={(event) => update({ maxConcurrency: Number(event.target.value) })}
            disabled={disabled}
            className="text-xs"
          />
        </div>
        <div className="grid gap-2">
          <Label
            htmlFor="project-retry-max-attempts"
            className="text-xs font-normal text-muted-foreground"
          >
            Retry max attempts
          </Label>
          <Input
            id="project-retry-max-attempts"
            type="number"
            min={1}
            step={1}
            value={value.retryMaxAttempts}
            onChange={(event) => update({ retryMaxAttempts: Number(event.target.value) })}
            disabled={disabled}
            className="text-xs"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-retry-backoff" className="text-xs font-normal text-muted-foreground">
            Retry backoff (ms)
          </Label>
          <Input
            id="project-retry-backoff"
            type="number"
            min={0}
            step={1000}
            value={value.retryBackoffMs}
            onChange={(event) => update({ retryBackoffMs: Number(event.target.value) })}
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>
    </div>
  );
}

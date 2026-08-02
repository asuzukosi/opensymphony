"use client";

import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { Label } from "@/components/ui/label";
import type { ProjectRuntimeFields } from "@/lib/create-project-form";
import { backoffMsToSeconds, backoffSecondsToMs } from "@/lib/retry-backoff";

type RuntimeFieldsProps = {
  value: ProjectRuntimeFields;
  onChange: (value: ProjectRuntimeFields) => void;
  disabled?: boolean;
};

function RuntimeNumberField({
  id,
  label,
  value,
  min,
  disabled,
  onValueChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <NumberField
        id={id}
        value={value}
        min={min}
        disabled={disabled}
        size="sm"
        onValueChange={(next) => {
          if (next != null) {
            onValueChange(next);
          }
        }}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
    </div>
  );
}

export function RuntimeFields({ value, onChange, disabled = false }: RuntimeFieldsProps) {
  const update = (patch: Partial<ProjectRuntimeFields>): void => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="grid gap-3">
      <Label>Runtime</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <RuntimeNumberField
          id="project-max-concurrency"
          label="Max concurrency"
          value={value.maxConcurrency}
          min={1}
          disabled={disabled}
          onValueChange={(maxConcurrency) => update({ maxConcurrency })}
        />
        <RuntimeNumberField
          id="project-retry-max-attempts"
          label="Retry max attempts"
          value={value.retryMaxAttempts}
          min={1}
          disabled={disabled}
          onValueChange={(retryMaxAttempts) => update({ retryMaxAttempts })}
        />
        <RuntimeNumberField
          id="project-retry-backoff"
          label="Retry backoff (seconds)"
          value={backoffMsToSeconds(value.retryBackoffMs)}
          min={0}
          disabled={disabled}
          onValueChange={(seconds) => update({ retryBackoffMs: backoffSecondsToMs(seconds) })}
        />
      </div>
    </div>
  );
}

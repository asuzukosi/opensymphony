"use client";

import { PlatformPickerField } from "@/components/project/platform-picker-field";
import type { PlatformId } from "@/lib/platforms";

type TaskExecutorFieldProps = {
  value: PlatformId | null;
  onChange: (executor: PlatformId | null) => void;
  platformIds: readonly PlatformId[];
  disabled?: boolean;
  isPlatformInstalled?: (platformId: PlatformId) => boolean;
  statusesLoading?: boolean;
  id?: string;
};

export function TaskExecutorField({
  value,
  onChange,
  platformIds,
  disabled = false,
  isPlatformInstalled,
  statusesLoading = false,
  id = "task-executor",
}: TaskExecutorFieldProps) {
  const selected = value != null ? [value] : [];
  const pickable = platformIds.filter((platformId) => platformId !== value);

  return (
    <PlatformPickerField
      label="Executor"
      description="Agent platform that runs this task. One platform per task."
      selected={selected}
      pickable={pickable}
      onSelect={onChange}
      onRemove={() => onChange(null)}
      disabled={disabled}
      isPlatformInstalled={isPlatformInstalled}
      statusesLoading={statusesLoading}
      addButtonAriaLabel="Select executor"
      labelId={id}
      footer={
        platformIds.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Assign platforms to this project before choosing an executor.
          </p>
        ) : null
      }
    />
  );
}

"use client";

import { PlatformPickerField } from "@/components/project/platform-picker-field";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";

type PlatformAssignFieldProps = {
  value: readonly PlatformId[];
  onChange: (platformIds: PlatformId[]) => void;
  disabled?: boolean;
  isPlatformInstalled?: (platformId: PlatformId) => boolean;
  statusesLoading?: boolean;
};

export function PlatformAssignField({
  value,
  onChange,
  disabled = false,
  isPlatformInstalled,
  statusesLoading = false,
}: PlatformAssignFieldProps) {
  const pickable = PLATFORMS.map((platform) => platform.id).filter((id) => !value.includes(id));

  return (
    <PlatformPickerField
      label="Assign to"
      description="Platforms enabled for this project. Tasks can be dispatched to any assigned platform."
      selected={value}
      pickable={pickable}
      onSelect={(platformId) => onChange([...value, platformId])}
      onRemove={(platformId) => onChange(value.filter((id) => id !== platformId))}
      disabled={disabled}
      isPlatformInstalled={isPlatformInstalled}
      statusesLoading={statusesLoading}
      addButtonAriaLabel="Add platform"
    />
  );
}

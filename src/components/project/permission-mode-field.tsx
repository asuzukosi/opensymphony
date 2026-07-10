"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PermissionMode } from "@/lib/ipc/types";

const PERMISSION_MODE_OPTIONS: Array<{ value: PermissionMode; label: string }> = [
  { value: "autoApprove", label: "Auto approve" },
  { value: "requiresApproval", label: "Requires approval" },
];

type PermissionModeFieldProps = {
  value: PermissionMode;
  onChange: (value: PermissionMode) => void;
  disabled?: boolean;
};

export function PermissionModeField({
  value,
  onChange,
  disabled = false,
}: PermissionModeFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="project-permission-mode">Permission mode</Label>
      <p className="text-xs text-muted-foreground">
        Auto approve skips the queue; requires approval blocks agents until you decide.
      </p>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as PermissionMode)}
        disabled={disabled}
      >
        <SelectTrigger id="project-permission-mode">
          <SelectValue placeholder="Select permission mode" />
        </SelectTrigger>
        <SelectContent>
          {PERMISSION_MODE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

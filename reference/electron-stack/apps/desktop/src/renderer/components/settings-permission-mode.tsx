import React, { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@symphony/ui";
import type { PermissionMode, PermissionModeSource } from "@/ipc";

const PERMISSION_MODE_OPTIONS: Array<{ value: PermissionMode; label: string }> = [
  { value: "auto_approve", label: "Auto approve" },
  { value: "requires_approval", label: "Requires approval" },
];

function formatPermissionMode(mode: PermissionMode): string {
  return PERMISSION_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

function formatPermissionModeSource(source: PermissionModeSource): string {
  return source === "override" ? "Override" : "Workflow";
}

type SettingsPermissionModeProps = {
  permissionMode: PermissionMode;
  permissionModeSource: PermissionModeSource;
  onApply: (permissionMode: PermissionMode) => Promise<void>;
  onReset: () => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function SettingsPermissionMode({
  permissionMode,
  permissionModeSource,
  onApply,
  onReset,
  isPending = false,
  submitError = null,
}: SettingsPermissionModeProps): React.JSX.Element {
  const [selectedMode, setSelectedMode] = useState<PermissionMode>(permissionMode);

  useEffect(() => {
    setSelectedMode(permissionMode);
  }, [permissionMode]);

  const handleApply = async (): Promise<void> => {
    try {
      await onApply(selectedMode);
    } catch {
      // surfaced via submitError
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">Agent permissions</h3>
          <Badge variant={permissionModeSource === "override" ? "default" : "secondary"}>
            {formatPermissionModeSource(permissionModeSource)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Active mode: {formatPermissionMode(permissionMode)}. Override ACP permission handling or
          reset to the workflow default.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-2">
          <Label htmlFor="permission-mode-select">Permission mode</Label>
          <Select
            value={selectedMode}
            onValueChange={(value) => setSelectedMode(value as PermissionMode)}
            disabled={isPending}
          >
            <SelectTrigger id="permission-mode-select" className="w-56">
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
        <Button type="button" disabled={isPending} onClick={() => void handleApply()}>
          {isPending ? "Applying..." : "Apply mode"}
        </Button>
        <Button type="button" variant="ghost" disabled={isPending} onClick={() => void onReset()}>
          Reset to workflow default
        </Button>
      </div>

      {submitError ? (
        <Alert variant="destructive">
          <AlertTitle>Permission mode update failed</AlertTitle>
          <AlertDescription>{submitError.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

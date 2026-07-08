"use client";

import { useEffect, useState } from "react";

import { FormRow } from "@/components/layout/form-row";
import { SurfaceCard } from "@/components/layout/surface-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type SettingsPermissionsSectionProps = {
  permissionMode: PermissionMode;
  onSavePermissionMode: (permissionMode: PermissionMode) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function SettingsPermissionsSection({
  permissionMode,
  onSavePermissionMode,
  isPending = false,
  submitError = null,
}: SettingsPermissionsSectionProps) {
  const [selectedMode, setSelectedMode] = useState<PermissionMode>(permissionMode);

  useEffect(() => {
    setSelectedMode(permissionMode);
  }, [permissionMode]);

  const isDirty = selectedMode !== permissionMode;
  const canSave = isDirty && !isPending;

  const handleSave = async (): Promise<void> => {
    try {
      await onSavePermissionMode(selectedMode);
    } catch {
      // api error surfaced via submitError
    }
  };

  return (
    <section id="permissions" aria-labelledby="settings-permissions-title">
      <SurfaceCard>
        <CardHeader className="pb-4">
          <CardTitle id="settings-permissions-title" className="text-base">
            Permissions
          </CardTitle>
          <CardDescription>
            Control how agent permission requests are handled for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormRow
            label="Permission mode"
            description="Auto approve skips the queue; requires approval blocks agents until you decide."
            htmlFor="permission-mode"
          >
            <Select
              value={selectedMode}
              onValueChange={(value) => setSelectedMode(value as PermissionMode)}
              disabled={isPending}
            >
              <SelectTrigger id="permission-mode">
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
          </FormRow>
          {submitError ? (
            <Alert variant="destructive">
              <AlertTitle>Permission mode update failed</AlertTitle>
              <AlertDescription>{submitError.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={!canSave} onClick={() => void handleSave()}>
              {isPending ? "Saving..." : "Save permission mode"}
            </Button>
          </div>
        </CardContent>
      </SurfaceCard>
    </section>
  );
}

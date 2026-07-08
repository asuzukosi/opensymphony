"use client";

import { useEffect, useState } from "react";

import { FormRow } from "@/components/layout/form-row";
import { SurfaceCard } from "@/components/layout/surface-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SettingsGeneralSectionProps = {
  name: string;
  onSaveName: (name: string) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function SettingsGeneralSection({
  name,
  onSaveName,
  isPending = false,
  submitError = null,
}: SettingsGeneralSectionProps) {
  const [draftName, setDraftName] = useState(name);
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  const isDirty = draftName.trim() !== name.trim();
  const canSave = isDirty && !isPending;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) {
      setInputError("Project name cannot be empty");
      return;
    }

    setInputError(null);
    try {
      await onSaveName(trimmed);
    } catch {
      // api error surfaced via submitError
    }
  };

  return (
    <section id="general" aria-labelledby="settings-general-title">
      <SurfaceCard>
        <CardHeader className="pb-4">
          <CardTitle id="settings-general-title" className="text-base">
            General
          </CardTitle>
          <CardDescription>Identity settings for the active project.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <FormRow
              label="Project name"
              description="Shown in the project switcher and page headers."
              htmlFor="project-name"
            >
              <Input
                id="project-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                disabled={isPending}
                autoComplete="off"
              />
            </FormRow>
            {inputError ? <p className="text-sm text-destructive">{inputError}</p> : null}
            {submitError ? (
              <Alert variant="destructive">
                <AlertTitle>Project name update failed</AlertTitle>
                <AlertDescription>{submitError.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={!canSave}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </SurfaceCard>
    </section>
  );
}

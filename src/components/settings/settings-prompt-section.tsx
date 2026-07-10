"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { FormRow } from "@/components/layout/form-row";
import { SurfaceCard } from "@/components/layout/surface-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const MonacoEditorField = dynamic(
  () =>
    import("@/components/ui/monaco").then((module) => ({
      default: module.MonacoEditorField,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[360px] w-full rounded-md" />,
  },
);

type SettingsPromptSectionProps = {
  promptTemplate: string;
  onSavePromptTemplate: (promptTemplate: string) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function SettingsPromptSection({
  promptTemplate,
  onSavePromptTemplate,
  isPending = false,
  submitError = null,
}: SettingsPromptSectionProps) {
  const [draft, setDraft] = useState(promptTemplate);
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(promptTemplate);
  }, [promptTemplate]);

  const isDirty = draft !== promptTemplate;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      setInputError("Prompt template cannot be empty");
      return;
    }

    setInputError(null);
    try {
      await onSavePromptTemplate(trimmed);
    } catch {
      // api error surfaced via submitError
    }
  };

  return (
    <section id="prompt" aria-labelledby="settings-prompt-title">
      <SurfaceCard>
        <CardHeader className="pb-4">
          <CardTitle id="settings-prompt-title" className="text-base">
            Prompt template
          </CardTitle>
          <CardDescription>
            Template sent to agents when a run starts. Supports {"{{identifier}}"}, {"{{title}}"}, and {"{{description}}"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <FormRow
              label="Template"
              description="Applied per dispatch for the active project."
              htmlFor="prompt-template"
            >
              <MonacoEditorField
                id="prompt-template"
                value={draft}
                onChange={setDraft}
                disabled={isPending}
              />
            </FormRow>
            {inputError ? <p className="text-sm text-destructive">{inputError}</p> : null}
            {submitError ? (
              <Alert variant="destructive">
                <AlertTitle>Prompt template update failed</AlertTitle>
                <AlertDescription>{submitError.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isPending || !isDirty}>
                {isPending ? "Saving..." : "Save template"}
              </Button>
            </div>
          </form>
        </CardContent>
      </SurfaceCard>
    </section>
  );
}

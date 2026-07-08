"use client";

import { useState } from "react";

import { FormRow } from "@/components/layout/form-row";
import { MetadataField } from "@/components/layout/metadata-field";
import { SurfaceCard } from "@/components/layout/surface-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SettingsWorkflowSectionProps = {
  workflowFilePath: string | null;
  workflowSource: string | null;
  workflowVersion: string | null;
  onLinkWorkflow: (sourcePath: string) => Promise<void>;
  onImportWorkflow: (sourcePath: string) => Promise<void>;
  isPending?: boolean;
  linkError?: Error | null;
  importError?: Error | null;
};

function formatWorkflowSource(source: string | null): string {
  if (!source) {
    return "None";
  }
  return source.replace(/_/g, " ");
}

export function SettingsWorkflowSection({
  workflowFilePath,
  workflowSource,
  workflowVersion,
  onLinkWorkflow,
  onImportWorkflow,
  isPending = false,
  linkError = null,
  importError = null,
}: SettingsWorkflowSectionProps) {
  const [sourcePath, setSourcePath] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const runAction = async (
    action: (path: string) => Promise<void>,
  ): Promise<void> => {
    const trimmed = sourcePath.trim();
    if (!trimmed) {
      setInputError("Source file path is required");
      return;
    }

    setInputError(null);
    try {
      await action(trimmed);
      setSourcePath("");
    } catch {
      // api error surfaced via linkError/importError
    }
  };

  return (
    <section id="workflow" aria-labelledby="settings-workflow-title">
      <SurfaceCard>
        <CardHeader className="pb-4">
          <CardTitle id="settings-workflow-title" className="text-base">
            Workflow
          </CardTitle>
          <CardDescription>
            Link or import a workflow file for the active project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormRow
            label="Workflow file path"
            description="Current workflow file linked to this project."
            htmlFor="workflow-file-path"
          >
            <Input
              id="workflow-file-path"
              value={workflowFilePath ?? ""}
              placeholder="Not linked"
              className="font-mono text-xs"
              readOnly
            />
          </FormRow>

          <dl className="grid gap-3 sm:grid-cols-2">
            <MetadataField label="Source" value={formatWorkflowSource(workflowSource)} />
            <MetadataField label="Version" value={workflowVersion ?? "Not loaded"} />
          </dl>

          <div className="space-y-4 border-t border-border/60 pt-6">
            <FormRow
              label="Source file path"
              description="Absolute path to a workflow file on disk."
              htmlFor="workflow-source-path"
            >
              <Input
                id="workflow-source-path"
                value={sourcePath}
                onChange={(event) => setSourcePath(event.target.value)}
                placeholder="/path/to/workflow.yaml"
                className="font-mono text-xs"
                disabled={isPending}
                autoComplete="off"
              />
            </FormRow>
            {inputError ? <p className="text-sm text-destructive">{inputError}</p> : null}
            {linkError ? (
              <Alert variant="destructive">
                <AlertTitle>Link workflow failed</AlertTitle>
                <AlertDescription>{linkError.message}</AlertDescription>
              </Alert>
            ) : null}
            {importError ? (
              <Alert variant="destructive">
                <AlertTitle>Import workflow failed</AlertTitle>
                <AlertDescription>{importError.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending || sourcePath.trim().length === 0}
                onClick={() => void runAction(onLinkWorkflow)}
              >
                {isPending ? "Linking..." : "Link file"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending || sourcePath.trim().length === 0}
                onClick={() => void runAction(onImportWorkflow)}
              >
                {isPending ? "Importing..." : "Import file"}
              </Button>
            </div>
          </div>
        </CardContent>
      </SurfaceCard>
    </section>
  );
}

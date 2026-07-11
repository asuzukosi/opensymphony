"use client";

import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { SettingsIcon } from "@/components/ui/hero-icons";
import { PageShell } from "@/components/layout/page-shell";
import { SurfaceCard } from "@/components/layout/surface-card";
import { SettingsGeneralSection } from "@/components/settings/settings-general-section";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { SettingsPlatformsSection } from "@/components/settings/settings-platforms-section";
import { SettingsPromptSection } from "@/components/settings/settings-prompt-section";
import { SettingsRuntimeSection } from "@/components/settings/settings-runtime-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveProject } from "@/contexts/active-project-context";
import { useProjectSettings } from "@/hooks/use-project-settings";

function ProjectSettingsLoadingState() {
  return (
    <>
      <SurfaceCard>
        <CardContent className="space-y-4 py-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full max-w-sm" />
        </CardContent>
      </SurfaceCard>
      <SurfaceCard>
        <CardContent className="space-y-4 py-6">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </SurfaceCard>
    </>
  );
}

export default function SettingsPage() {
  const { projectId, isLoading: isProjectLoading } = useActiveProject();
  const {
    settings,
    error,
    isLoading,
    setName,
    setPollInterval,
    setMaxConcurrency,
    setRetryPolicy,
    setPromptTemplate,
    isMutating,
    mutationError,
    resetMutation,
  } = useProjectSettings({ enabled: projectId != null });
  const [failedSave, setFailedSave] = useState(false);
  const [failedRuntimeAction, setFailedRuntimeAction] = useState<
    "pollInterval" | "maxConcurrency" | "retryPolicy" | null
  >(null);
  const [failedPromptTemplate, setFailedPromptTemplate] = useState(false);

  const isProjectSettingsLoading =
    projectId != null && (isProjectLoading || (isLoading && settings === undefined));

  const clearFailedActions = (): void => {
    setFailedSave(false);
    setFailedRuntimeAction(null);
    setFailedPromptTemplate(false);
  };

  const handleSaveName = async (name: string): Promise<void> => {
    resetMutation();
    clearFailedActions();

    try {
      await setName(name);
    } catch {
      setFailedSave(true);
    }
  };

  const handleSavePollInterval = async (pollIntervalMs: number): Promise<void> => {
    resetMutation();
    clearFailedActions();

    try {
      await setPollInterval(pollIntervalMs);
    } catch {
      setFailedRuntimeAction("pollInterval");
    }
  };

  const handleSaveMaxConcurrency = async (maxConcurrency: number): Promise<void> => {
    resetMutation();
    clearFailedActions();

    try {
      await setMaxConcurrency(maxConcurrency);
    } catch {
      setFailedRuntimeAction("maxConcurrency");
    }
  };

  const handleSaveRetryPolicy = async (maxAttempts: number, backoffMs: number): Promise<void> => {
    resetMutation();
    clearFailedActions();

    try {
      await setRetryPolicy(maxAttempts, backoffMs);
    } catch {
      setFailedRuntimeAction("retryPolicy");
    }
  };

  const handleSavePromptTemplate = async (promptTemplate: string): Promise<void> => {
    resetMutation();
    clearFailedActions();

    try {
      await setPromptTemplate(promptTemplate);
    } catch {
      setFailedPromptTemplate(true);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Configuration"
        icon={SettingsIcon}
        title="Settings"
        description="Platform install status and active project configuration."
      />

      {projectId == null ? (
        <Alert>
          <AlertTitle>No active project</AlertTitle>
          <AlertDescription>Select a project to view and edit project settings.</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Settings unavailable</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsLayout>
        <SettingsPlatformsSection />
        {isProjectSettingsLoading ? (
          <ProjectSettingsLoadingState />
        ) : projectId != null && settings ? (
          <>
            <SettingsGeneralSection
              name={settings.name}
              onSaveName={handleSaveName}
              isPending={isMutating}
              submitError={failedSave ? mutationError : null}
            />
            <SettingsPromptSection
              promptTemplate={settings.promptTemplate}
              onSavePromptTemplate={handleSavePromptTemplate}
              isPending={isMutating}
              submitError={failedPromptTemplate ? mutationError : null}
            />
            <SettingsRuntimeSection
              pollIntervalMs={settings.pollIntervalMs}
              maxConcurrency={settings.maxConcurrency}
              retryPolicy={settings.retryPolicy}
              onSavePollInterval={handleSavePollInterval}
              onSaveMaxConcurrency={handleSaveMaxConcurrency}
              onSaveRetryPolicy={handleSaveRetryPolicy}
              isPending={isMutating}
              pollIntervalError={
                failedRuntimeAction === "pollInterval" ? mutationError : null
              }
              maxConcurrencyError={
                failedRuntimeAction === "maxConcurrency" ? mutationError : null
              }
              retryPolicyError={failedRuntimeAction === "retryPolicy" ? mutationError : null}
            />
          </>
        ) : null}
      </SettingsLayout>
    </PageShell>
  );
}

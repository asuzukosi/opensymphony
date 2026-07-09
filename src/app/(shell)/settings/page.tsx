"use client";

import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { SettingsIcon } from "@/components/layout/nav-icons";
import { PageShell } from "@/components/layout/page-shell";
import { SurfaceCard } from "@/components/layout/surface-card";
import { SettingsGeneralSection } from "@/components/settings/settings-general-section";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { SettingsPermissionsSection } from "@/components/settings/settings-permissions-section";
import { SettingsPromptSection } from "@/components/settings/settings-prompt-section";
import { SettingsRuntimeSection } from "@/components/settings/settings-runtime-section";
import { SettingsWorkflowSection } from "@/components/settings/settings-workflow-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveProject } from "@/contexts/active-project-context";
import { useProjectSettings } from "@/hooks/use-project-settings";
import type { PermissionMode } from "@/lib/ipc/types";

function SettingsLoadingState() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Configuration"
        icon={SettingsIcon}
        title="Settings"
        description="Configure the active project workflow, runtime, and permissions."
        isLoading
      />
      <SettingsLayout activeSection="general">
        <SurfaceCard>
          <CardContent className="space-y-4 py-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-10 w-full max-w-sm" />
          </CardContent>
        </SurfaceCard>
      </SettingsLayout>
    </PageShell>
  );
}

export default function SettingsPage() {
  const { projectId, isLoading: isProjectLoading } = useActiveProject();
  const {
    settings,
    error,
    isLoading,
    setName,
    setWorkflowFile,
    importWorkflowFile,
    setPollInterval,
    setMaxConcurrency,
    setRetryPolicy,
    setPermissionMode,
    setPromptTemplate,
    isMutating,
    mutationError,
    resetMutation,
  } = useProjectSettings({ enabled: projectId != null });
  const [failedSave, setFailedSave] = useState(false);
  const [failedWorkflowAction, setFailedWorkflowAction] = useState<"link" | "import" | null>(
    null,
  );
  const [failedRuntimeAction, setFailedRuntimeAction] = useState<
    "pollInterval" | "maxConcurrency" | "retryPolicy" | null
  >(null);
  const [failedPermissionMode, setFailedPermissionMode] = useState(false);
  const [failedPromptTemplate, setFailedPromptTemplate] = useState(false);

  const isInitialLoading =
    isProjectLoading || (projectId != null && isLoading && settings === undefined);

  const clearFailedActions = (): void => {
    setFailedSave(false);
    setFailedWorkflowAction(null);
    setFailedRuntimeAction(null);
    setFailedPermissionMode(false);
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

  const handleLinkWorkflow = async (sourcePath: string): Promise<void> => {
    resetMutation();
    clearFailedActions();

    try {
      await setWorkflowFile(sourcePath);
    } catch {
      setFailedWorkflowAction("link");
    }
  };

  const handleImportWorkflow = async (sourcePath: string): Promise<void> => {
    resetMutation();
    clearFailedActions();

    try {
      await importWorkflowFile(sourcePath);
    } catch {
      setFailedWorkflowAction("import");
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

  const handleSavePermissionMode = async (permissionMode: PermissionMode): Promise<void> => {
    resetMutation();
    clearFailedActions();

    try {
      await setPermissionMode(permissionMode);
    } catch {
      setFailedPermissionMode(true);
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

  if (isInitialLoading) {
    return <SettingsLoadingState />;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Configuration"
        icon={SettingsIcon}
        title="Settings"
        description="Configure the active project workflow, runtime, and permissions."
      />

      {projectId == null ? (
        <Alert>
          <AlertTitle>No active project</AlertTitle>
          <AlertDescription>Select a project to view and edit settings.</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Settings unavailable</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {projectId != null && settings ? (
        <SettingsLayout>
          <SettingsGeneralSection
            name={settings.name}
            onSaveName={handleSaveName}
            isPending={isMutating}
            submitError={failedSave ? mutationError : null}
          />
          <SettingsWorkflowSection
            workflowFilePath={settings.workflowFilePath}
            workflowSource={settings.workflowSource}
            workflowVersion={settings.workflowVersion}
            onLinkWorkflow={handleLinkWorkflow}
            onImportWorkflow={handleImportWorkflow}
            isPending={isMutating}
            linkError={failedWorkflowAction === "link" ? mutationError : null}
            importError={failedWorkflowAction === "import" ? mutationError : null}
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
          <SettingsPermissionsSection
            permissionMode={settings.permissionMode}
            onSavePermissionMode={handleSavePermissionMode}
            isPending={isMutating}
            submitError={failedPermissionMode ? mutationError : null}
          />
        </SettingsLayout>
      ) : null}
    </PageShell>
  );
}

"use client";

import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { SurfaceCard } from "@/components/layout/surface-card";
import { SettingsPlatformsSection } from "@/components/settings/settings-platforms-section";
import { SettingsRuntimeSection } from "@/components/settings/settings-runtime-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardContent } from "@/components/ui/card";
import { AgentsIcon, CodeIcon, SettingsIcon } from "@/components/ui/hero-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActiveProject } from "@/contexts/active-project-context";
import { useProjectSettings } from "@/hooks/use-project-settings";

function RuntimeSettingsLoadingState() {
  return (
    <SurfaceCard>
      <CardContent className="space-y-4 py-6">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-10 w-full max-w-sm" />
      </CardContent>
    </SurfaceCard>
  );
}

export default function SettingsPage() {
  const { projectId, isLoading: isProjectLoading } = useActiveProject();
  const {
    settings,
    error,
    isLoading,
    setMaxConcurrency,
    setRetryPolicy,
    isMutating,
    mutationError,
    resetMutation,
  } = useProjectSettings({ enabled: projectId != null });
  const [failedRuntimeAction, setFailedRuntimeAction] = useState<
    "maxConcurrency" | "retryPolicy" | null
  >(null);

  const isRuntimeSettingsLoading =
    projectId != null && (isProjectLoading || (isLoading && settings === undefined));

  const clearFailedActions = (): void => {
    setFailedRuntimeAction(null);
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

  return (
    <PageShell>
      <PageHeader
        eyebrow="Configuration"
        icon={SettingsIcon}
        title="Settings"
        description="Platform install status and active project runtime configuration."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Settings unavailable</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="platforms" className="w-full">
        <TabsList>
          <TabsTrigger value="platforms">
            <AgentsIcon />
            Platforms
          </TabsTrigger>
          <TabsTrigger value="runtime">
            <CodeIcon />
            Runtime
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platforms">
          <SettingsPlatformsSection />
        </TabsContent>

        <TabsContent value="runtime">
          {projectId == null ? (
            <Alert>
              <AlertTitle>No active project</AlertTitle>
              <AlertDescription>
                Select a project to view and edit runtime settings.
              </AlertDescription>
            </Alert>
          ) : isRuntimeSettingsLoading ? (
            <RuntimeSettingsLoadingState />
          ) : settings ? (
            <SettingsRuntimeSection
              maxConcurrency={settings.maxConcurrency}
              retryPolicy={settings.retryPolicy}
              onSaveMaxConcurrency={handleSaveMaxConcurrency}
              onSaveRetryPolicy={handleSaveRetryPolicy}
              isPending={isMutating}
              maxConcurrencyError={failedRuntimeAction === "maxConcurrency" ? mutationError : null}
              retryPolicyError={failedRuntimeAction === "retryPolicy" ? mutationError : null}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

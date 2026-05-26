import React, { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import {
  Badge,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@symphony/ui";
import { SettingsPollInterval } from "@/renderer/components/settings-poll-interval";
import { SettingsReadonlyConfig } from "@/renderer/components/settings-readonly-config";
import { SettingsRuntimeControls } from "@/renderer/components/settings-runtime-controls";
import { MetadataField } from "@/renderer/layout/metadata-field";
import { PageHeader } from "@/renderer/layout/page-header";
import { PageShell } from "@/renderer/layout/page-shell";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import {
  RuntimeStatusBadge,
} from "@/renderer/components/runtime-status-badge";
import { useRuntimeControls, useSettings } from "@/renderer/hooks";

type SettingsAction = "control" | "poll";

function SettingsLoadingState(): React.JSX.Element {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Configuration"
        icon={SettingsIcon}
        title="Settings"
        description="Control orchestration execution and review runtime configuration."
        isLoading
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </CardContent>
        </SurfaceCard>
        <SurfaceCard>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full rounded-lg" />
          </CardContent>
        </SurfaceCard>
      </div>
    </PageShell>
  );
}

export function Settings(): React.JSX.Element {
  const { settings, error: settingsError, isLoading, refetch } = useSettings();
  const {
    start,
    stop,
    tick,
    setPollInterval,
    clearPollIntervalOverride,
    isPending,
    error: controlsError,
    reset: resetControls,
  } = useRuntimeControls();
  const [failedAction, setFailedAction] = useState<SettingsAction | null>(null);

  const runControl = async (
    action: () => Promise<unknown>,
    actionType: SettingsAction,
  ): Promise<void> => {
    resetControls();
    setFailedAction(null);
    try {
      await action();
      await refetch();
    } catch {
      setFailedAction(actionType);
    }
  };

  if (isLoading) {
    return <SettingsLoadingState />;
  }

  if (!settings) {
    return (
      <PageShell>
        <PageHeader
          variant="compact"
          eyebrow="Configuration"
          icon={SettingsIcon}
          title="Settings"
          description="Control orchestration execution and review runtime configuration."
        />
        <SurfaceCard>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Runtime settings could not be loaded.
          </CardContent>
        </SurfaceCard>
      </PageShell>
    );
  }

  const badgeStatus = settings.status;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Configuration"
        icon={SettingsIcon}
        title="Settings"
        description="Control orchestration execution and review runtime configuration."
        metaLabel="Runtime status"
        meta={<RuntimeStatusBadge status={badgeStatus} className="px-3 py-1 text-sm" />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Runtime status</CardTitle>
            <CardDescription>Current orchestrator state and execution metrics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid gap-3 sm:grid-cols-2">
              <MetadataField
                label="Status"
                value={<Badge variant="outline">{settings.status}</Badge>}
              />
              <MetadataField
                label="Started at"
                value={
                  settings.startedAt
                    ? new Date(settings.startedAt).toLocaleString()
                    : "Not started"
                }
              />
              <MetadataField
                label="Poll interval"
                value={
                  <span className="font-mono tabular-nums">{settings.pollIntervalMs} ms</span>
                }
              />
              <MetadataField label="Poll source" value={settings.pollIntervalSource} />
              <MetadataField
                label="Next tick"
                value={
                  settings.nextTickAt
                    ? new Date(settings.nextTickAt).toLocaleString()
                    : "n/a"
                }
              />
              <MetadataField
                label="Total ticks"
                value={<span className="font-mono tabular-nums">{settings.tickCount}</span>}
              />
              <MetadataField
                label="Last tick"
                value={
                  settings.lastTickAt
                    ? new Date(settings.lastTickAt).toLocaleString()
                    : "Never"
                }
              />
              <MetadataField label="Last action" value={settings.lastAction ?? "n/a"} />
            </dl>

            {settings.lastError ? (
              <MetadataField
                label="Last error"
                value={<span className="text-destructive">{settings.lastError}</span>}
                className="sm:col-span-2"
              />
            ) : null}

            {settingsError ? (
              <p className="text-sm text-destructive">Settings error: {settingsError.message}</p>
            ) : null}
          </CardContent>
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Controls</CardTitle>
            <CardDescription>Start, stop, and tune orchestration behavior.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SettingsRuntimeControls
              onStart={() => runControl(start, "control")}
              onStop={() => runControl(stop, "control")}
              onTick={() => runControl(tick, "control")}
              isPending={isPending}
              submitError={failedAction === "control" ? controlsError : null}
            />

            <SettingsPollInterval
              pollIntervalMs={settings.pollIntervalMs}
              pollIntervalSource={settings.pollIntervalSource}
              onApply={(pollIntervalMs) =>
                runControl(() => setPollInterval(pollIntervalMs), "poll")
              }
              onReset={() => runControl(clearPollIntervalOverride, "poll")}
              isPending={isPending}
              submitError={failedAction === "poll" ? controlsError : null}
            />
          </CardContent>
        </SurfaceCard>
      </div>

      <SettingsReadonlyConfig settings={settings} />
    </PageShell>
  );
}

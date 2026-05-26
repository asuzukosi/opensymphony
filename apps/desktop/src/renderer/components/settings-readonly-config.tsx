import React from "react";
import { Badge, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@symphony/ui";
import { MetadataField } from "@/renderer/layout/metadata-field";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import type { RuntimeAdapterKind, SettingsView } from "@/ipc";

type SettingsReadonlyConfigProps = {
  settings: SettingsView;
};

function formatRuntimeAdapterKind(kind: RuntimeAdapterKind): string {
  if (kind === "mock-acp") {
    return "Mock ACP";
  }
  if (kind === "acp-cli") {
    return "ACP CLI";
  }
  return kind;
}

function formatAcpCommand(settings: SettingsView): string {
  const parts = [settings.acp.command, ...settings.acp.args].filter(Boolean);
  return parts.join(" ");
}

export function SettingsReadonlyConfig({ settings }: SettingsReadonlyConfigProps): React.JSX.Element {
  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Configuration</CardTitle>
        <CardDescription>Read-only workflow and ACP settings from the active runtime.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="workflow-path-input" className="text-xs text-muted-foreground">
            Workflow path
          </Label>
          <Input
            id="workflow-path-input"
            type="text"
            value={settings.workflowPath}
            placeholder="path/to/WORKFLOW.md"
            className="font-mono text-xs"
            readOnly
          />
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetadataField label="Workflow version" value={settings.workflowVersion ?? "Not loaded"} />
          <MetadataField
            label="Runtime adapter"
            value={
              <Badge variant="outline" className="font-normal">
                {formatRuntimeAdapterKind(settings.runtimeAdapterKind)}
              </Badge>
            }
          />
          <MetadataField
            label="Project id"
            value={<span className="font-mono text-sm">{settings.project.id}</span>}
          />
          <MetadataField label="Project name" value={settings.project.name} />
          <MetadataField
            label="Project slug"
            value={<span className="font-mono text-sm">{settings.project.slug}</span>}
          />
        </dl>

        <div className="space-y-4 border-t border-border/60 pt-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold tracking-tight">ACP configuration</h3>
            <p className="text-sm text-muted-foreground">
              Agent subprocess settings loaded from WORKFLOW.md.
            </p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <MetadataField
              label="Mode"
              value={<Badge variant="outline">{settings.acp.mode}</Badge>}
            />
            <MetadataField
              label="Mock completion delay"
              value={
                settings.acp.mode === "mock"
                  ? `${settings.acp.mockCompletionDelayMs} ms`
                  : "n/a"
              }
            />
          </dl>
          <div className="space-y-2">
            <Label htmlFor="acp-command-input" className="text-xs text-muted-foreground">
              Command
            </Label>
            <Input
              id="acp-command-input"
              type="text"
              value={formatAcpCommand(settings)}
              className="font-mono text-xs"
              readOnly
            />
          </div>
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

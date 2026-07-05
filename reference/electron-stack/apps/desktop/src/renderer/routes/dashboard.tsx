import React from "react";
import { DashboardEmptyState } from "@/renderer/components/dashboard-empty-state";
import { DashboardErrorAlert } from "@/renderer/components/dashboard-error-alert";
import { DashboardHero } from "@/renderer/components/dashboard-hero";
import { DashboardMetrics } from "@/renderer/components/dashboard-metrics";
import { DashboardRetryTable } from "@/renderer/components/dashboard-retry-table";
import { DashboardRunningTable } from "@/renderer/components/dashboard-running-table";
import { DashboardRuntimeSnapshot } from "@/renderer/components/dashboard-runtime-snapshot";
import { DashboardValidationAlert } from "@/renderer/components/dashboard-validation-alert";
import { PageShell } from "@/renderer/layout/page-shell";
import { useRuntimeState } from "@/renderer/hooks/use-runtime-state";

function DashboardLoadingState(): React.JSX.Element {
  return (
    <PageShell>
      <DashboardHero isLoading />
      <DashboardMetrics isLoading />
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardRunningTable isLoading />
        <DashboardRetryTable isLoading />
      </div>
      <DashboardRuntimeSnapshot isLoading />
    </PageShell>
  );
}

export function Dashboard(): React.JSX.Element {
  const { snapshot, error, isLoading } = useRuntimeState();
  const isInitialLoading = isLoading && !snapshot;

  if (isInitialLoading) {
    return <DashboardLoadingState />;
  }

  if (!snapshot) {
    return (
      <PageShell>
        <DashboardHero hasError={Boolean(error)} />
        {error ? <DashboardErrorAlert error={error} /> : <DashboardEmptyState />}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <DashboardHero status={snapshot.status} hasError={Boolean(error)} />
      {error ? <DashboardErrorAlert error={error} /> : null}
      <DashboardValidationAlert validationError={snapshot.validationError} />
      <DashboardMetrics counts={snapshot.counts} agentTotals={snapshot.agentTotals} />
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardRunningTable running={snapshot.running} />
        <DashboardRetryTable retrying={snapshot.retrying} />
      </div>
      <DashboardRuntimeSnapshot snapshot={snapshot} />
    </PageShell>
  );
}

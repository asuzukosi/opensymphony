import React from "react";
import { Alert, AlertDescription, AlertTitle, cn } from "@symphony/ui";
import { AgentsColumns } from "@/renderer/components/agents-columns";
import { AgentsEmptyState } from "@/renderer/components/agents-empty-state";
import { AgentsErrorAlert } from "@/renderer/components/agents-error-alert";
import { AgentsHeader } from "@/renderer/components/agents-header";
import { AgentsLoadingState } from "@/renderer/components/agents-loading-state";
import { DashboardValidationAlert } from "@/renderer/components/dashboard-validation-alert";
import { PageShell } from "@/renderer/layout/page-shell";
import { surfaceAlertClass } from "@/renderer/lib/surface-styles";
import { useRuntimeControls, useRuntimeState } from "@/renderer/hooks";

export function Agents(): React.JSX.Element {
  const { snapshot, error, isLoading, isRefreshing, refetch } = useRuntimeState();
  const {
    tick,
    pauseRun,
    resumeRun,
    cancelRun,
    isPending: isControlPending,
    error: tickError,
    reset: resetTick,
  } = useRuntimeControls();
  const isInitialLoading = isLoading && !snapshot;

  const runControl = async (action: (runAttemptId: string) => Promise<unknown>, runAttemptId: string) => {
    resetTick();
    try {
      await action(runAttemptId);
      await refetch();
    } catch {
      // surfaced via tickError
    }
  };

  const handleRefresh = (): void => {
    resetTick();
    void (async () => {
      try {
        await tick();
        await refetch();
      } catch {
        // surfaced via tickError
      }
    })();
  };

  if (isInitialLoading) {
    return (
      <PageShell width="full">
        <AgentsLoadingState />
      </PageShell>
    );
  }

  if (!snapshot) {
    return (
      <PageShell width="full">
        <AgentsHeader
          status="idle"
          hasError={Boolean(error)}
          isRefreshing={isRefreshing}
          isTickPending={isControlPending}
          onRefresh={handleRefresh}
        />
        {error ? <AgentsErrorAlert error={error} /> : <AgentsEmptyState />}
        {tickError ? (
          <Alert variant="destructive" className={surfaceAlertClass}>
            <AlertTitle>Tick failed</AlertTitle>
            <AlertDescription>{tickError.message}</AlertDescription>
          </Alert>
        ) : null}
      </PageShell>
    );
  }

  return (
    <PageShell width="full" className="min-h-0 flex-1 overflow-hidden">
      <AgentsHeader
        status={snapshot.status}
        hasError={Boolean(error)}
        isRefreshing={isRefreshing}
        isTickPending={isControlPending}
        onRefresh={handleRefresh}
      />

      {error ? <div className="shrink-0"><AgentsErrorAlert error={error} /></div> : null}
      {tickError ? (
        <Alert variant="destructive" className={cn(surfaceAlertClass, "shrink-0")}>
          <AlertTitle>Tick failed</AlertTitle>
          <AlertDescription>{tickError.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="shrink-0">
        <DashboardValidationAlert validationError={snapshot.validationError} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AgentsColumns
          candidates={snapshot.candidates}
          running={snapshot.running}
          retrying={snapshot.retrying}
          recentFinished={snapshot.recentFinished}
          runControlsDisabled={isControlPending}
          onPauseRun={(runAttemptId) => runControl(pauseRun, runAttemptId)}
          onResumeRun={(runAttemptId) => runControl(resumeRun, runAttemptId)}
          onCancelRun={(runAttemptId) => runControl(cancelRun, runAttemptId)}
        />
      </div>
    </PageShell>
  );
}

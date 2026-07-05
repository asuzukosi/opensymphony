import React from "react";
import { Activity } from "lucide-react";
import {
  RuntimeStatusBadge,
  type RuntimeStatusBadgeValue,
} from "@/renderer/components/runtime-status-badge";
import { PageHeader } from "@/renderer/layout/page-header";
import type { RuntimeStatus } from "@/ipc";

type DashboardHeroProps = {
  status?: RuntimeStatus;
  hasError?: boolean;
  isLoading?: boolean;
};

function resolveStatus({
  status,
  hasError,
}: Pick<DashboardHeroProps, "status" | "hasError">): RuntimeStatusBadgeValue {
  if (hasError) {
    return "error";
  }
  return status ?? "idle";
}

export function DashboardHero({
  status,
  hasError = false,
  isLoading = false,
}: DashboardHeroProps): React.JSX.Element {
  const badgeStatus = resolveStatus({ status, hasError });

  return (
    <PageHeader
      eyebrow="Orchestrator overview"
      icon={Activity}
      title="Dashboard"
      description="Monitor runtime health, active agent sessions, and orchestration activity across your local Symphony workspace."
      metaLabel="Runtime status"
      meta={<RuntimeStatusBadge status={badgeStatus} className="px-3 py-1 text-sm" />}
      isLoading={isLoading}
    />
  );
}

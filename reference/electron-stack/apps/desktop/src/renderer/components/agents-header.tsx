import React from "react";
import { Bot } from "lucide-react";
import { Button } from "@symphony/ui";
import {
  RuntimeStatusBadge,
  type RuntimeStatusBadgeValue,
} from "@/renderer/components/runtime-status-badge";
import { PageHeader } from "@/renderer/layout/page-header";
import type { RuntimeStatus } from "@/ipc";

type AgentsHeaderProps = {
  status: RuntimeStatus;
  hasError?: boolean;
  isRefreshing?: boolean;
  isTickPending?: boolean;
  onRefresh: () => void;
};

export function AgentsHeader({
  status,
  hasError = false,
  isRefreshing = false,
  isTickPending = false,
  onRefresh,
}: AgentsHeaderProps): React.JSX.Element {
  const badgeStatus: RuntimeStatusBadgeValue = hasError ? "error" : status;
  const isBusy = isRefreshing || isTickPending;

  return (
    <PageHeader
      eyebrow="Agent pipeline"
      icon={Bot}
      title="Agents"
      description="Monitor dispatch candidates, active sessions, retries, and recent activity."
      className="shrink-0"
      metaLabel="Runtime status"
      meta={<RuntimeStatusBadge status={badgeStatus} className="px-3 py-1 text-sm" />}
      actions={
        <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={onRefresh}>
          {isBusy ? "Refreshing..." : "Run tick"}
        </Button>
      }
    />
  );
}

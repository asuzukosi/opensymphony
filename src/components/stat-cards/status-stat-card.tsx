import { HeroIcon } from "@/components/ui/hero-icons";
import { StatCardShell } from "@/components/stat-cards/stat-card-shell";
import type { RuntimeStatus } from "@/lib/ipc/types";
import { capitalize } from "@/lib/utils";

function StatusIcon() {
  return (
    <HeroIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
      />
    </HeroIcon>
  );
}

type StatusStatCardProps = {
  status?: RuntimeStatus;
  isLoading?: boolean;
};

export function StatusStatCard({ status, isLoading = false }: StatusStatCardProps) {
  return (
    <StatCardShell
      title="Status"
      value={status ? capitalize(status) : "Idle"}
      description="Orchestrator lifecycle state"
      icon={<StatusIcon />}
      isLoading={isLoading}
    />
  );
}

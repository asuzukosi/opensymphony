import { HeroIcon } from "@/components/ui/hero-icons";
import { StatCardShell } from "@/components/stat-cards/stat-card-shell";

function RetryIcon() {
  return (
    <HeroIcon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
      />
    </HeroIcon>
  );
}

type RetryStatCardProps = {
  count?: number;
  isLoading?: boolean;
};

export function RetryStatCard({ count = 0, isLoading = false }: RetryStatCardProps) {
  return (
    <StatCardShell
      title="Retrying"
      value={count}
      description="Issues waiting for retry"
      icon={<RetryIcon />}
      isLoading={isLoading}
    />
  );
}

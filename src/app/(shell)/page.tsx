import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";
import { DashboardIcon } from "@/components/ui/hero-icons";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

export default function HomePage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Overview"
        icon={DashboardIcon}
        title="Dashboard"
        description="Runtime overview for the active project."
      />
      <DashboardPageContent />
    </PageShell>
  );
}

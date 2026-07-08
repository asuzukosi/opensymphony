import { DashboardPageContent } from "@/components/dashboard/dashboard-page-content";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";

export default function HomePage() {
  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Runtime overview for the active project."
      />
      <DashboardPageContent />
    </PageShell>
  );
}

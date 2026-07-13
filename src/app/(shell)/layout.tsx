import { Suspense } from "react";

import { IssueSheetHost } from "@/components/issue/issue-detail-sheet";
import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActiveProjectProvider } from "@/contexts/active-project-context";

export default function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ActiveProjectProvider>
      <AppShell>{children}</AppShell>
      <TooltipProvider delayDuration={300}>
        <Suspense fallback={null}>
          <IssueSheetHost />
        </Suspense>
      </TooltipProvider>
    </ActiveProjectProvider>
  );
}

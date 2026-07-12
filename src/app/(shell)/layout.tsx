import { AppShell } from "@/components/layout/app-shell";
import { ActiveProjectProvider } from "@/contexts/active-project-context";
import { IssueSheetProvider } from "@/contexts/issue-sheet-context";

export default function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ActiveProjectProvider>
      <IssueSheetProvider>
        <AppShell>{children}</AppShell>
      </IssueSheetProvider>
    </ActiveProjectProvider>
  );
}

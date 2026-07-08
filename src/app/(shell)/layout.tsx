import { AppShell } from "@/components/layout/app-shell";
import { ActiveProjectProvider } from "@/contexts/active-project-context";

export default function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ActiveProjectProvider>
      <AppShell>{children}</AppShell>
    </ActiveProjectProvider>
  );
}

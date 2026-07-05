import React from "react";
import { Bot, Kanban, LayoutDashboard, Settings, Sparkles, type LucideIcon } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  cn,
} from "@symphony/ui";
import { ACPPermissionQueue } from "@/renderer/components/acp-permission-queue";
import { usePendingPermissions } from "@/renderer/hooks/use-pending-permissions";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/board", label: "Board", icon: Kanban },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/board": "Task board",
  "/agents": "Agents",
  "/settings": "Settings",
};

function resolvePageTitle(pathname: string): string {
  if (pathname.startsWith("/issues/")) {
    return "Issue detail";
  }
  return pageTitles[pathname] ?? "Symphony";
}

function SidebarNavLink({ to, label, icon: Icon }: NavItem): React.JSX.Element {
  const location = useLocation();
  const active =
    to === "/"
      ? location.pathname === "/"
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link to={to}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppShell(): React.JSX.Element {
  const location = useLocation();
  const pageTitle = resolvePageTitle(location.pathname);
  const {
    permissions,
    pendingCount,
    isApprovalRequired,
    resolveAsync,
    isResolving,
    resolvingId,
    resolveError,
  } = usePendingPermissions();
  const showPermissionQueue = isApprovalRequired && pendingCount > 0;

  return (
    <SidebarProvider className="min-h-svh overflow-hidden">
      <Sidebar variant="inset" className="border-r border-sidebar-border">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Symphony</p>
              <p className="truncate text-xs text-sidebar-foreground/70">Local orchestrator</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarNavLink key={item.to} {...item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="h-4 w-px bg-border/60" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{pageTitle}</p>
            <p className="truncate text-xs text-muted-foreground">Symphony Desktop</p>
          </div>
        </header>
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/10 p-4 md:p-6 lg:p-8",
          )}
        >
          {showPermissionQueue ? (
            <ACPPermissionQueue
              className="mb-4"
              permissions={permissions}
              onResolve={resolveAsync}
              isPending={isResolving}
              resolvingId={resolvingId}
              submitError={resolveError}
            />
          ) : null}
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

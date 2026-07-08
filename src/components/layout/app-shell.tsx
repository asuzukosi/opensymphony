"use client";

import { Bot, Kanban, LayoutDashboard, Settings, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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
} from "@/components/ui/sidebar";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/board", label: "Board", icon: Kanban },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/board": "Task board",
  "/agents": "Agents",
  "/settings": "Settings",
};

function resolvePageTitle(pathname: string): string {
  if (pathname.startsWith("/issue/")) {
    return "Issue detail";
  }
  return pageTitles[pathname] ?? "Open Symphony";
}

type SidebarNavLinkProps = NavItem;

function SidebarNavLink({ href, label, icon: Icon }: SidebarNavLinkProps) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link href={href}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

type AppShellProps = {
  children: ReactNode;
  className?: string;
};

export function AppShell({ children, className }: AppShellProps) {
  const pathname = usePathname();
  const pageTitle = resolvePageTitle(pathname);

  return (
    <SidebarProvider className="min-h-svh overflow-hidden">
      <Sidebar variant="inset" className="border-r border-sidebar-border">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Open Symphony</p>
              <p className="truncate text-xs text-sidebar-foreground/70">Local agent orchestrator</p>
            </div>
          </div>
          <div className="px-2 pb-3">
            <ProjectSwitcher />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarNavLink key={item.href} {...item} />
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
            <p className="truncate text-xs text-muted-foreground">Open Symphony</p>
          </div>
        </header>
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-auto bg-page p-4 md:p-6 lg:p-8",
            className,
          )}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

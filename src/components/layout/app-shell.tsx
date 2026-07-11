"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";

import {
  AgentsIcon,
  BoardIcon,
  DashboardIcon,
  SettingsIcon,
} from "@/components/ui/hero-icons";
import { ProjectSwitcher } from "@/components/project/project-switcher";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/board", label: "Board", icon: BoardIcon },
  { href: "/agents", label: "Agents", icon: AgentsIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
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
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className="min-h-svh overflow-hidden">
        <Sidebar variant="sidebar" className="border-r border-sidebar-border">
          <SidebarHeader className="border-b border-sidebar-border">
            <div
              data-tauri-drag-region
              className="flex cursor-default select-none items-center gap-2 px-2 pb-3 pt-8"
            >
              <div className="min-w-0">
                <p className="truncate font-brand text-xs font-bold tracking-wide">OPENSYMPHONY</p>
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
            <div
              data-tauri-drag-region
              className="flex min-h-full min-w-0 flex-1 cursor-default select-none items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{pageTitle}</p>
                <p className="truncate text-xs text-muted-foreground">Open Symphony</p>
              </div>
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
    </TooltipProvider>
  );
}

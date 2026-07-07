import type { ReactNode } from "react";

import {
  SettingsNav,
  type SettingsSectionId,
} from "@/components/settings/settings-nav";
import { cn } from "@/lib/utils";

type SettingsLayoutProps = {
  children: ReactNode;
  activeSection?: SettingsSectionId;
  className?: string;
};

export function SettingsLayout({ children, activeSection, className }: SettingsLayoutProps) {
  return (
    <div className={cn("flex flex-col gap-section lg:flex-row lg:items-start", className)}>
      <SettingsNav activeSection={activeSection} />
      <div className="min-w-0 flex-1 space-y-section">{children}</div>
    </div>
  );
}

export type { SettingsSectionId };

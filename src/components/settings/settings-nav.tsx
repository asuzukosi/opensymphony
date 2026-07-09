import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = [
  { id: "general", label: "General" },
  { id: "workflow", label: "Workflow" },
  { id: "prompt", label: "Prompt" },
  { id: "runtime", label: "Runtime" },
  { id: "permissions", label: "Permissions" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

type SettingsNavProps = {
  activeSection?: SettingsSectionId;
  className?: string;
};

export function SettingsNav({ activeSection, className }: SettingsNavProps) {
  return (
    <nav aria-label="Settings sections" className={cn("w-full shrink-0 lg:w-settings-nav", className)}>
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {SETTINGS_SECTIONS.map(({ id, label }) => {
          const isActive = activeSection === id;

          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

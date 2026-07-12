"use client";

import { SurfaceCard } from "@/components/layout/surface-card";
import { PlatformAvatar } from "@/components/ui/platform-avatar";
import { BadgeCheckIcon } from "@/components/ui/hero-icons";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformStatuses } from "@/hooks/use-platform-statuses";
import { PLATFORMS } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const wrapText = "min-w-0 max-w-full break-words [overflow-wrap:anywhere]";

export function SettingsPlatformsSection() {
  const { statuses, isPlatformInstalled, isLoading } = usePlatformStatuses();

  return (
    <SurfaceCard>
        <CardHeader className="pb-4">
          <CardTitle id="settings-platforms-title" className="text-sm">
            <span className="text-sm">Platforms</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Install status for supported agent platforms. Assign platforms when creating a project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 md:grid-cols-2">
            {isLoading
              ? Array.from({ length: 6 }, (_, index) => (
                  <li key={index} className="flex min-w-0 items-center gap-3 rounded-md border border-border/60 p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </li>
                ))
              : PLATFORMS.map((platform) => {
                  const installed = isPlatformInstalled(platform.id);
                  const status = statuses?.find((entry) => entry.platform === platform.id);

                  return (
                    <li
                      key={platform.id}
                      className="flex min-w-0 items-start gap-3 rounded-md border border-border/60 p-3"
                    >
                      <PlatformAvatar platformId={platform.id} size="md" tooltip={false} />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="text-xs font-medium">{platform.label}</p>
                          {installed ? (
                            <Badge variant="secondary" className="shrink-0">
                              <BadgeCheckIcon data-icon="inline-start" />
                              Installed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0">
                              Not installed
                            </Badge>
                          )}
                        </div>
                        <p className={cn(wrapText, "font-mono text-xs text-muted-foreground")}>
                          {platform.acpCommand}
                        </p>
                        {!installed && status?.missingBinaries.length ? (
                          <p className={cn(wrapText, "text-xs text-muted-foreground")}>
                            Missing: {status.missingBinaries.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
          </ul>
        </CardContent>
      </SurfaceCard>
  );
}

"use client";

import { PlusIcon } from "@/components/ui/hero-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { PlatformAvatar } from "@/components/ui/platform-avatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getPlatform, PLATFORMS, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const addButtonClassName = "h-9 w-9 shrink-0";

type PlatformAssignFieldProps = {
  value: readonly PlatformId[];
  onChange: (platformIds: PlatformId[]) => void;
  disabled?: boolean;
};

export function PlatformAssignField({
  value,
  onChange,
  disabled = false,
}: PlatformAssignFieldProps) {
  const availablePlatforms = PLATFORMS.filter((platform) => !value.includes(platform.id));

  const handleAdd = (platformId: PlatformId): void => {
    onChange([...value, platformId]);
  };

  const handleRemove = (platformId: PlatformId): void => {
    onChange(value.filter((id) => id !== platformId));
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid gap-2">
        <Label>Assign to</Label>
        <p className="text-xs text-muted-foreground">
          Platforms enabled for this project. Issues can be dispatched to any assigned platform.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {value.map((platformId) => (
            <PlatformAvatar
              key={platformId}
              platformId={platformId}
              disabled={disabled}
              tooltip={`${getPlatform(platformId).label} — click to remove`}
              onClick={() => handleRemove(platformId)}
            />
          ))}
          {availablePlatforms.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={disabled}
                  className={cn("rounded-full", addButtonClassName)}
                  aria-label="Add platform"
                >
                  <PlusIcon className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {availablePlatforms.map((platform) => (
                  <DropdownMenuItem
                    key={platform.id}
                    onSelect={() => handleAdd(platform.id)}
                  >
                    <PlatformAvatar
                      platformId={platform.id}
                      size="sm"
                      tooltip={false}
                      className="mr-2"
                    />
                    {platform.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

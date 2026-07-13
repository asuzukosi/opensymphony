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
import { getPlatform, resolvePlatformInstalled, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const addButtonClassName = "h-8 w-8 shrink-0 rounded-full";

type PlatformPickerMenuItemProps = {
  platformId: PlatformId;
  installed: boolean;
  onSelect: (platformId: PlatformId) => void;
};

function PlatformPickerMenuItem({ platformId, installed, onSelect }: PlatformPickerMenuItemProps) {
  const platform = getPlatform(platformId);
  const row = (
    <>
      <PlatformAvatar
        platformId={platformId}
        size="sm"
        uninstalled={!installed}
        tooltip={false}
        className="mr-2"
      />
      <span className={cn(!installed && "text-muted-foreground")}>{platform.label}</span>
    </>
  );

  return (
    <DropdownMenuItem
      aria-disabled={!installed}
      className={cn(!installed && "cursor-not-allowed opacity-60")}
      title={!installed ? `${platform.label} not installed on this computer` : undefined}
      onSelect={(event) => {
        if (!installed) {
          event.preventDefault();
          return;
        }
        onSelect(platformId);
      }}
    >
      {row}
    </DropdownMenuItem>
  );
}

type PlatformPickerFieldProps = {
  label: string;
  description: string;
  selected: readonly PlatformId[];
  pickable: readonly PlatformId[];
  onSelect: (platformId: PlatformId) => void;
  onRemove: (platformId: PlatformId) => void;
  disabled?: boolean;
  isPlatformInstalled?: (platformId: PlatformId) => boolean;
  statusesLoading?: boolean;
  addButtonAriaLabel: string;
  labelId?: string;
  footer?: React.ReactNode;
};

export function PlatformPickerField({
  label,
  description,
  selected,
  pickable,
  onSelect,
  onRemove,
  disabled = false,
  isPlatformInstalled,
  statusesLoading = false,
  addButtonAriaLabel,
  labelId,
  footer,
}: PlatformPickerFieldProps) {
  return (
    <div className="grid gap-2">
      <Label id={labelId}>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center gap-2" aria-labelledby={labelId}>
        {selected.map((platformId) => (
          <PlatformAvatar
            key={platformId}
            platformId={platformId}
            disabled={disabled}
            tooltip={`${getPlatform(platformId).label} — click to remove`}
            onClick={() => onRemove(platformId)}
          />
        ))}
        {pickable.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled || statusesLoading}
                className={addButtonClassName}
                aria-label={addButtonAriaLabel}
              >
                <PlusIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="z-[60] w-52"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              {pickable.map((platformId) => (
                <PlatformPickerMenuItem
                  key={platformId}
                  platformId={platformId}
                  installed={resolvePlatformInstalled(platformId, isPlatformInstalled, statusesLoading)}
                  onSelect={onSelect}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {footer}
    </div>
  );
}

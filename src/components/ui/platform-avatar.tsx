"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getPlatform, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const sizeClassName = {
  sm: "h-5 w-5",
  md: "h-9 w-9",
  lg: "h-11 w-11",
} as const;

const imagePaddingClassName = {
  sm: "p-0.5",
  md: "p-1.5",
  lg: "p-2",
} as const;

export type PlatformAvatarSize = keyof typeof sizeClassName;

type PlatformAvatarProps = {
  platformId: PlatformId;
  size?: PlatformAvatarSize;
  className?: string;
  /** defaults to platform label; pass false to hide tooltip */
  tooltip?: string | false;
  disabled?: boolean;
  onClick?: () => void;
};

export function PlatformAvatar({
  platformId,
  size = "md",
  className,
  tooltip,
  disabled = false,
  onClick,
}: PlatformAvatarProps) {
  const platform = getPlatform(platformId);
  const isInteractive = onClick != null;
  const tooltipText = tooltip === false ? null : (tooltip ?? platform.label);

  const avatar = isInteractive ? (
    <button
      type="button"
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full border border-border bg-background",
        sizeClassName[size],
        !disabled && "transition-shadow hover:ring-2 hover:ring-ring hover:ring-offset-2",
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      aria-label={tooltipText ?? platform.label}
    >
      <img
        src={platform.logoPath}
        alt=""
        className={cn("h-full w-full object-contain", imagePaddingClassName[size])}
      />
    </button>
  ) : (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background",
        sizeClassName[size],
        className,
      )}
      aria-hidden={tooltipText == null}
    >
      <img
        src={platform.logoPath}
        alt=""
        className={cn("h-full w-full object-contain", imagePaddingClassName[size])}
      />
    </span>
  );

  if (tooltipText == null) {
    return avatar;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{avatar}</TooltipTrigger>
      <TooltipContent side="bottom">{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

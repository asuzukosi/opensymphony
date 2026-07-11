"use client";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
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
  /** cli not on path — grayed appearance */
  uninstalled?: boolean;
  onClick?: () => void;
};

export function PlatformAvatar({
  platformId,
  size = "md",
  className,
  tooltip,
  disabled = false,
  uninstalled = false,
  onClick,
}: PlatformAvatarProps) {
  const platform = getPlatform(platformId);
  const tooltipText = tooltip === false ? null : (tooltip ?? platform.label);

  const avatar = (
    <Avatar
      className={cn(
        "border border-border bg-background",
        sizeClassName[size],
        uninstalled && "opacity-50 grayscale",
        onClick && !disabled && "transition-shadow hover:ring-2 hover:ring-ring hover:ring-offset-2",
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      <AvatarImage
        src={platform.logoPath}
        alt=""
        className={cn("object-contain", imagePaddingClassName[size])}
      />
    </Avatar>
  );

  const trigger = onClick ? (
    <button
      type="button"
      className="rounded-full"
      disabled={disabled}
      onClick={onClick}
      aria-label={tooltipText ?? platform.label}
    >
      {avatar}
    </button>
  ) : (
    avatar
  );

  if (tooltipText == null) {
    return trigger;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="bottom">{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

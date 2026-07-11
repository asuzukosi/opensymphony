"use client";

import type { VariantProps } from "class-variance-authority";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type IssuePriorityValue = 0 | 1 | 2 | 3;

type IssuePriorityBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

type IssuePriorityOption = {
  value: IssuePriorityValue;
  label: string;
  badgeVariant: IssuePriorityBadgeVariant;
};

export const ISSUE_PRIORITY_OPTIONS: readonly IssuePriorityOption[] = [
  { value: 0, label: "Urgent", badgeVariant: "priorityUrgent" },
  { value: 1, label: "High", badgeVariant: "priorityHigh" },
  { value: 2, label: "Medium", badgeVariant: "priorityMedium" },
  { value: 3, label: "Low", badgeVariant: "priorityLow" },
] as const;

const NONE_VALUE = "__none__";

function getIssuePriorityOption(priority: number | null | undefined): IssuePriorityOption | null {
  if (priority == null) {
    return null;
  }
  return ISSUE_PRIORITY_OPTIONS.find((option) => option.value === priority) ?? null;
}

type IssuePriorityBadgeProps = {
  priority: number | null | undefined;
  className?: string;
};

export function IssuePriorityBadge({ priority, className }: IssuePriorityBadgeProps) {
  const option = getIssuePriorityOption(priority);
  if (option == null) {
    return null;
  }

  return (
    <Badge variant={option.badgeVariant} className={cn("font-normal", className)}>
      {option.label}
    </Badge>
  );
}

type IssuePriorityFieldProps = {
  value: number | null;
  onChange: (priority: number | null) => void;
  disabled?: boolean;
  id?: string;
};

export function IssuePriorityField({
  value,
  onChange,
  disabled = false,
  id = "issue-priority",
}: IssuePriorityFieldProps) {
  const selected = getIssuePriorityOption(value);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Priority</Label>
      <Select
        value={value == null ? NONE_VALUE : String(value)}
        onValueChange={(nextValue) => {
          if (nextValue === NONE_VALUE) {
            onChange(null);
            return;
          }
          onChange(Number(nextValue) as IssuePriorityValue);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select priority">
            {selected ? <IssuePriorityBadge priority={selected.value} /> : "Select priority"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>None</SelectItem>
          {ISSUE_PRIORITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={String(option.value)}>
              <IssuePriorityBadge priority={option.value} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

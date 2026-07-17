"use client";

import type { VariantProps } from "class-variance-authority";

import { PlusIcon } from "@/components/ui/hero-icons";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type TaskPriorityValue = 0 | 1 | 2 | 3;

type TaskPriorityBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

type TaskPriorityOption = {
  value: TaskPriorityValue;
  label: string;
  badgeVariant: TaskPriorityBadgeVariant;
};

export const TASK_PRIORITY_OPTIONS: readonly TaskPriorityOption[] = [
  { value: 0, label: "Urgent", badgeVariant: "priorityUrgent" },
  { value: 1, label: "High", badgeVariant: "priorityHigh" },
  { value: 2, label: "Medium", badgeVariant: "priorityMedium" },
  { value: 3, label: "Low", badgeVariant: "priorityLow" },
] as const;

export const compactPriorityBadgeClass =
  "h-4 min-h-0 rounded-full px-1.5 py-0 text-[9px] font-normal leading-none shadow-none";

const addButtonClassName = "h-8 w-8 shrink-0 rounded-full";

function getTaskPriorityOption(priority: number | null | undefined): TaskPriorityOption | null {
  if (priority == null) {
    return null;
  }
  return TASK_PRIORITY_OPTIONS.find((option) => option.value === priority) ?? null;
}

type TaskPriorityBadgeProps = {
  priority: number | null | undefined;
  className?: string;
};

export function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  const option = getTaskPriorityOption(priority);
  if (option == null) {
    return null;
  }

  return (
    <Badge variant={option.badgeVariant} className={cn(compactPriorityBadgeClass, className)}>
      {option.label}
    </Badge>
  );
}

type TaskPriorityFieldProps = {
  value: number | null;
  onChange: (priority: number | null) => void;
  disabled?: boolean;
  id?: string;
};

export function TaskPriorityField({
  value,
  onChange,
  disabled = false,
  id = "task-priority",
}: TaskPriorityFieldProps) {
  const selected = getTaskPriorityOption(value);
  const pickable = TASK_PRIORITY_OPTIONS.filter((option) => option.value !== value);

  return (
    <div className="grid gap-2">
      <Label id={id}>Priority</Label>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby={id}>
        {selected ? (
          <button
            type="button"
            disabled={disabled}
            title={`${selected.label} — click to remove`}
            aria-label={`${selected.label} priority — click to remove`}
            onClick={() => onChange(null)}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <TaskPriorityBadge priority={selected.value} />
          </button>
        ) : null}
        {pickable.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                className={addButtonClassName}
                aria-label="Select priority"
              >
                <PlusIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="z-[60] w-40"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              {pickable.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => onChange(option.value)}
                >
                  <TaskPriorityBadge priority={option.value} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import type { VariantProps } from "class-variance-authority";
import { useState } from "react";
import type { ComponentType, SVGProps } from "react";

import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/ui/timeline";
import { TaskCommentBody } from "@/components/task/task-comment-body";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import {
  BoltIcon,
  ChatBubbleLeftIcon,
  CommandLineIcon,
  ExclamationCircleIcon,
  ShieldExclamationIcon,
  WrenchScrewdriverIcon,
} from "@/components/ui/hero-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/datetime";
import type { FormattedToolCall } from "@/lib/format-tool-call";
import type { SessionEvent, SessionEventKind } from "@/lib/ipc/types";
import {
  type TimelinePreview,
  getTimelineMarkdown,
  getTimelinePreview,
  isTimelineExpandable,
} from "@/lib/session-timeline-content";
import { cn, wrapText } from "@/lib/utils";

type TaskSessionTimelineProps = {
  events: SessionEvent[];
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
};

type TimelineKindConfig = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badgeVariant?: NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
};

const timelineKindConfig: Record<Exclude<SessionEventKind, "StreamChunk">, TimelineKindConfig> = {
  Prompt: {
    label: "Prompt",
    icon: ChatBubbleLeftIcon,
  },
  ToolCall: {
    label: "Tool call",
    icon: WrenchScrewdriverIcon,
  },
  ToolResult: {
    label: "Tool result",
    icon: WrenchScrewdriverIcon,
  },
  PermissionRequest: {
    label: "Permission",
    icon: ShieldExclamationIcon,
    badgeVariant: "warning-light",
  },
  SessionUpdate: {
    label: "Update",
    icon: BoltIcon,
  },
  Error: {
    label: "Error",
    icon: ExclamationCircleIcon,
    badgeVariant: "destructive-light",
  },
  Terminal: {
    label: "Terminal",
    icon: CommandLineIcon,
  },
};

type ToolStatusBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const TOOL_STATUS_BADGE_VARIANTS: Record<string, ToolStatusBadgeVariant> = {
  pending: "outline",
  in_progress: "warning-light",
  completed: "success-light",
  failed: "destructive",
};

function formatToolLabel(value: string): string {
  return value
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toolStatusBadgeVariant(status: string): ToolStatusBadgeVariant {
  return TOOL_STATUS_BADGE_VARIANTS[status] ?? "outline";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function isAgentMessageEvent(event: SessionEvent): boolean {
  const record = asRecord(event.payload);
  const update = asRecord(record?.update);
  return (
    event.kind === "StreamChunk" &&
    update?.sessionUpdate === "agent_message" &&
    typeof asRecord(update.content)?.text === "string"
  );
}

function filterTimelineEvents(events: SessionEvent[]): SessionEvent[] {
  return events.filter((event) => event.kind !== "StreamChunk" || isAgentMessageEvent(event));
}

function sortTimelineEvents(events: SessionEvent[]): SessionEvent[] {
  return [...events].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return right.createdAt.localeCompare(left.createdAt);
    }
    return rightTime - leftTime;
  });
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ToolCallPreviewBody({ tool }: { tool: FormattedToolCall }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Badge
        variant={toolStatusBadgeVariant(tool.status)}
        size="xs"
        radius="full"
        className="font-normal uppercase"
      >
        {formatToolLabel(tool.status)}
      </Badge>
    </div>
  );
}

function TimelinePreviewBody({ preview }: { preview: TimelinePreview }) {
  if (preview.tool != null) {
    return (
      <div className="space-y-0.5">
        <p className={cn(wrapText, "text-[10px] text-foreground/90")}>{preview.text}</p>
        {preview.detail != null ? (
          <p className={cn(wrapText, "text-[9px] text-muted-foreground")}>{preview.detail}</p>
        ) : null}
        <ToolCallPreviewBody tool={preview.tool} />
      </div>
    );
  }

  return <p className={cn(wrapText, "text-[10px] text-foreground/90")}>{preview.text}</p>;
}

function SessionTimelineItem({ event, step }: { event: SessionEvent; step: number }) {
  const [expanded, setExpanded] = useState(false);

  if (event.kind === "StreamChunk" && !isAgentMessageEvent(event)) {
    return null;
  }

  const isAgentMessage = isAgentMessageEvent(event);
  const config = isAgentMessage
    ? { label: "Message", icon: ChatBubbleLeftIcon }
    : timelineKindConfig[event.kind as Exclude<SessionEventKind, "StreamChunk">];
  const Icon = config.icon;
  const preview = getTimelinePreview(event);
  const markdown = getTimelineMarkdown(event);
  const expandable = isTimelineExpandable(event);

  if (preview == null) {
    return null;
  }

  return (
    <TimelineItem step={step} className="group-data-[orientation=vertical]/timeline:ms-10">
      <TimelineHeader>
        <TimelineSeparator className="group-data-[orientation=vertical]/timeline:-left-7" />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TimelineTitle className="sr-only">{config.label}</TimelineTitle>
          <Badge
            variant={"badgeVariant" in config ? (config.badgeVariant ?? "outline") : "outline"}
            size="xs"
            radius="full"
            className="font-normal uppercase"
          >
            {config.label}
          </Badge>
          <TimelineDate className="mb-0 mt-0 text-[10px]">
            {formatDateTime(event.createdAt)}
          </TimelineDate>
        </div>
        <TimelineIndicator className="group-data-[orientation=vertical]/timeline:-left-7 flex size-6 items-center justify-center border-border/60 bg-background">
          <Icon className="size-3 text-muted-foreground" />
        </TimelineIndicator>
      </TimelineHeader>
      <TimelineContent>
        <button
          type="button"
          disabled={!expandable}
          onClick={() => {
            if (expandable) {
              setExpanded((current) => !current);
            }
          }}
          className={cn(
            "w-full rounded-md p-1.5 text-left transition-colors",
            expandable && "cursor-pointer hover:bg-muted/40",
            expanded && "bg-muted/30 px-2 py-1.5",
          )}
        >
          {expanded && markdown != null ? (
            <TaskCommentBody body={markdown} compact />
          ) : (
            <TimelinePreviewBody preview={preview} />
          )}
        </button>
      </TimelineContent>
    </TimelineItem>
  );
}

export function TaskSessionTimeline({
  events,
  isLoading = false,
  emptyMessage = "No session events recorded yet.",
  className,
}: TaskSessionTimelineProps) {
  const visibleEvents = sortTimelineEvents(filterTimelineEvents(events));

  if (isLoading) {
    return (
      <div className={className}>
        <TimelineSkeleton />
      </div>
    );
  }

  if (visibleEvents.length === 0) {
    return (
      <div className={className}>
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <Timeline defaultValue={visibleEvents.length}>
        {visibleEvents.map((event, index) => (
          <SessionTimelineItem key={event.id} event={event} step={index + 1} />
        ))}
      </Timeline>
    </div>
  );
}

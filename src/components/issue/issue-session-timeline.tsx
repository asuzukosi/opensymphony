"use client";

import type { ComponentType, SVGProps } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
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
import type { SessionEvent, SessionEventKind } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

type IssueSessionTimelineProps = {
  events: SessionEvent[];
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
};

type TimelineKindConfig = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badgeVariant?: "outline" | "warning" | "destructive";
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
    badgeVariant: "warning",
  },
  SessionUpdate: {
    label: "Update",
    icon: BoltIcon,
  },
  Error: {
    label: "Error",
    icon: ExclamationCircleIcon,
    badgeVariant: "destructive",
  },
  Terminal: {
    label: "Terminal",
    icon: CommandLineIcon,
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function truncateText(text: string, maxLength = 240): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function payloadText(payload: unknown, fallback: string): string {
  if (typeof payload === "string") {
    return truncateText(payload);
  }
  const record = asRecord(payload);
  if (record == null) {
    return fallback;
  }
  if (typeof record.text === "string") {
    return truncateText(record.text);
  }
  if (typeof record.message === "string") {
    return truncateText(record.message);
  }
  if (typeof record.body === "string") {
    return truncateText(record.body);
  }
  return fallback;
}

function formatEventBody(event: SessionEvent): string {
  switch (event.kind) {
    case "Prompt":
      return payloadText(event.payload, "Prompt sent to agent");
    case "ToolCall":
      return payloadText(event.payload, "Tool call");
    case "ToolResult":
      return payloadText(event.payload, "Tool result");
    case "PermissionRequest":
      return payloadText(event.payload, "Permission requested");
    case "Error":
      return payloadText(event.payload, "Session error");
    case "SessionUpdate":
      return payloadText(event.payload, "Session update");
    case "Terminal":
      return payloadText(event.payload, "Terminal event");
    case "StreamChunk":
      return payloadText(event.payload, "Stream chunk");
    default:
      return "Session event";
  }
}

function eventBodyClassName(kind: SessionEventKind): string {
  const wrap = "min-w-0 max-w-full break-words [overflow-wrap:anywhere]";
  if (kind === "Error") {
    return cn(wrap, "text-sm text-destructive");
  }
  if (kind === "Prompt") {
    return cn(wrap, "whitespace-pre-wrap font-mono text-xs");
  }
  return cn(wrap, "text-sm");
}

function filterTimelineEvents(events: SessionEvent[]): SessionEvent[] {
  return events.filter((event) => event.kind !== "StreamChunk");
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

function TimelineEmptyState({ message }: { message: string }) {
  return <EmptyState title={message} className="py-8" />;
}

function TimelineItem({ event }: { event: SessionEvent }) {
  if (event.kind === "StreamChunk") {
    return null;
  }

  const config = timelineKindConfig[event.kind];
  const Icon = config.icon;
  const body = formatEventBody(event);

  return (
    <li className="relative min-w-0 pl-6">
      <span className="absolute left-0 top-1 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border border-border/60 bg-background">
        <Icon className="h-2.5 w-2.5 text-muted-foreground" />
      </span>
      <div className="min-w-0 space-y-1 overflow-hidden rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <Badge
            variant={config.badgeVariant ?? "outline"}
            className="text-[10px] uppercase"
          >
            {config.label}
          </Badge>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={event.createdAt}>
            {formatDateTime(event.createdAt)}
          </time>
        </div>
        <p className={eventBodyClassName(event.kind)}>{body}</p>
      </div>
    </li>
  );
}

export function IssueSessionTimeline({
  events,
  isLoading = false,
  emptyMessage = "No session events recorded yet.",
  className,
}: IssueSessionTimelineProps) {
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
        <TimelineEmptyState message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <ol className="relative min-w-0 space-y-4 border-l border-border/60">
        {visibleEvents.map((event) => (
          <TimelineItem key={event.id} event={event} />
        ))}
      </ol>
    </div>
  );
}

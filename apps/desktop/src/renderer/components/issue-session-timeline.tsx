import React from "react";
import {
  Activity,
  AlertCircle,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Text,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge, cn, Skeleton } from "@symphony/ui";
import type { SessionEvent, SessionEventKind } from "@/ipc";
import { surfaceEmptyStateClass } from "@/renderer/lib/surface-styles";

type IssueSessionTimelineProps = {
  events: SessionEvent[];
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
};

type TimelineKindConfig = {
  label: string;
  icon: LucideIcon;
  badgeClassName?: string;
};

const timelineKindConfig: Record<SessionEventKind, TimelineKindConfig> = {
  prompt: {
    label: "Prompt",
    icon: MessageSquare,
  },
  stream_chunk: {
    label: "Stream",
    icon: Text,
  },
  tool_call: {
    label: "Tool",
    icon: Wrench,
  },
  permission_request: {
    label: "Permission",
    icon: ShieldAlert,
    badgeClassName: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  },
  permission_resolve: {
    label: "Decision",
    icon: ShieldCheck,
  },
  session_update: {
    label: "Update",
    icon: Activity,
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    badgeClassName: "border-destructive/40 text-destructive",
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function formatTimestamp(createdAt: string): string {
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) {
    return createdAt;
  }
  return new Date(parsed).toLocaleString();
}

function truncateText(text: string, maxLength = 240): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function formatPromptBody(payload: unknown): string {
  const record = asRecord(payload);
  const text = record?.text;
  return typeof text === "string" ? truncateText(text) : "Prompt sent to agent";
}

function formatStreamChunkBody(payload: unknown): string {
  const record = asRecord(payload);
  const update = asRecord(record?.update);
  const content = asRecord(update?.content);
  if (typeof content?.text === "string") {
    return truncateText(content.text);
  }
  if (typeof record?.chunk === "string") {
    return truncateText(record.chunk);
  }
  return "Agent stream update";
}

function formatToolCallBody(payload: unknown): string {
  const record = asRecord(payload);
  const update = asRecord(record?.update);
  const source = update ?? record;
  const title = source?.title;
  const kind = source?.kind;
  const status = source?.status;
  const parts = [
    typeof title === "string" ? title : "Tool call",
    typeof kind === "string" ? kind : null,
    typeof status === "string" ? status : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function formatPermissionRequestBody(payload: unknown): string {
  const record = asRecord(payload);
  const toolCall = asRecord(record?.toolCall);
  const title = toolCall?.title;
  return typeof title === "string" ? title : "Permission requested";
}

function formatPermissionResolveBody(payload: unknown): string {
  const record = asRecord(payload);
  const response = asRecord(record?.response);
  const outcome = asRecord(response?.outcome);
  const request = asRecord(record?.request);
  const toolCall = asRecord(request?.toolCall);
  const title = typeof toolCall?.title === "string" ? toolCall.title : "permission";

  if (outcome?.outcome === "cancelled") {
    return `Cancelled: ${title}`;
  }

  if (outcome?.outcome === "selected") {
    const optionId = outcome.optionId;
    if (typeof optionId === "string" && optionId.includes("reject")) {
      return `Denied: ${title}`;
    }
    return `Approved: ${title}`;
  }

  return "Permission resolved";
}

function formatErrorBody(payload: unknown): string {
  const record = asRecord(payload);
  const message = record?.message;
  return typeof message === "string" ? message : "Session error";
}

function formatSessionUpdateBody(payload: unknown): string {
  const record = asRecord(payload);
  const update = asRecord(record?.update);
  const kind = update?.sessionUpdate;
  return typeof kind === "string" ? `Session update: ${kind}` : "Session update";
}

function formatEventBody(event: SessionEvent): string {
  switch (event.kind) {
    case "prompt":
      return formatPromptBody(event.payload);
    case "stream_chunk":
      return formatStreamChunkBody(event.payload);
    case "tool_call":
      return formatToolCallBody(event.payload);
    case "permission_request":
      return formatPermissionRequestBody(event.payload);
    case "permission_resolve":
      return formatPermissionResolveBody(event.payload);
    case "error":
      return formatErrorBody(event.payload);
    case "session_update":
      return formatSessionUpdateBody(event.payload);
    default:
      return "Session event";
  }
}

function eventBodyClassName(kind: SessionEventKind): string {
  if (kind === "error") {
    return "text-destructive";
  }
  if (kind === "prompt" || kind === "stream_chunk") {
    return "whitespace-pre-wrap font-mono text-xs";
  }
  return "text-sm";
}

function TimelineSkeleton(): React.JSX.Element {
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

function TimelineEmptyState({ message }: { message: string }): React.JSX.Element {
  return (
    <div className={cn(surfaceEmptyStateClass, "py-8")}>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

type TimelineItemProps = {
  event: SessionEvent;
};

function TimelineItem({ event }: TimelineItemProps): React.JSX.Element {
  const config = timelineKindConfig[event.kind];
  const Icon = config.icon;
  const body = formatEventBody(event);

  return (
    <li className="relative pl-6">
      <span className="absolute left-0 top-1 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border border-border/60 bg-background">
        <Icon className="h-2.5 w-2.5 text-muted-foreground" />
      </span>
      <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className={cn("text-[10px] uppercase", config.badgeClassName)}>
            {config.label}
          </Badge>
          <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
            {formatTimestamp(event.createdAt)}
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
}: IssueSessionTimelineProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div className={className}>
        <TimelineSkeleton />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={className}>
        <TimelineEmptyState message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={className}>
      <ol className="relative space-y-4 border-l border-border/60">
        {events.map((event) => (
          <TimelineItem key={event.id} event={event} />
        ))}
      </ol>
    </div>
  );
}

import type { ActivityTimeRange } from "@/lib/ipc/types";

export type ActivityTimeRangePresetId = "1h" | "6h" | "24h" | "7d" | "30d" | "custom";

export type ActivityTimeRangeBucketId = "auto" | "5m" | "15m" | "1h" | "6h" | "1d";

export const ACTIVITY_TIME_RANGE_PRESET_OPTIONS: {
  id: ActivityTimeRangePresetId;
  label: string;
}[] = [
  { id: "1h", label: "Last 1 hour" },
  { id: "6h", label: "Last 6 hours" },
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "custom", label: "Custom" },
];

export const ACTIVITY_TIME_RANGE_BUCKET_OPTIONS: {
  id: ActivityTimeRangeBucketId;
  label: string;
}[] = [
  { id: "auto", label: "Auto" },
  { id: "5m", label: "5 minutes" },
  { id: "15m", label: "15 minutes" },
  { id: "1h", label: "1 hour" },
  { id: "6h", label: "6 hours" },
  { id: "1d", label: "1 day" },
];

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const BUCKET_MS_BY_ID: Record<Exclude<ActivityTimeRangeBucketId, "auto">, number> = {
  "5m": 5 * MINUTE_MS,
  "15m": 15 * MINUTE_MS,
  "1h": HOUR_MS,
  "6h": 6 * HOUR_MS,
  "1d": DAY_MS,
};

const PRESET_DURATION_MS: Record<Exclude<ActivityTimeRangePresetId, "custom">, number> = {
  "1h": HOUR_MS,
  "6h": 6 * HOUR_MS,
  "24h": DAY_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
};

export const DEFAULT_ACTIVITY_TIME_RANGE_PRESET: Exclude<
  ActivityTimeRangePresetId,
  "custom"
> = "24h";

export const DEFAULT_ACTIVITY_TIME_RANGE_BUCKET: ActivityTimeRangeBucketId = "auto";

export function presetDurationMs(
  preset: Exclude<ActivityTimeRangePresetId, "custom">,
): number {
  return PRESET_DURATION_MS[preset];
}

export function deriveAutoBucketMs(rangeMs: number): number {
  if (rangeMs <= 6 * HOUR_MS) {
    return BUCKET_MS_BY_ID["5m"];
  }
  if (rangeMs <= DAY_MS) {
    return BUCKET_MS_BY_ID["15m"];
  }
  if (rangeMs <= 7 * DAY_MS) {
    return BUCKET_MS_BY_ID["1h"];
  }
  if (rangeMs <= 30 * DAY_MS) {
    return BUCKET_MS_BY_ID["6h"];
  }
  return BUCKET_MS_BY_ID["1d"];
}

export function resolveBucketMs(
  rangeMs: number,
  bucketId: ActivityTimeRangeBucketId,
): number {
  if (bucketId === "auto") {
    return deriveAutoBucketMs(rangeMs);
  }
  return BUCKET_MS_BY_ID[bucketId];
}

export function toDatetimeLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}

export function defaultCustomRange(now = new Date()): { startAt: string; endAt: string } {
  const endAt = now.toISOString();
  const startAt = new Date(now.getTime() - DAY_MS).toISOString();
  return { startAt, endAt };
}

type BuildActivityTimeRangeInput = {
  preset: ActivityTimeRangePresetId;
  customStartAt?: string;
  customEndAt?: string;
  bucketId: ActivityTimeRangeBucketId;
  now?: Date;
};

export function buildActivityTimeRange({
  preset,
  customStartAt,
  customEndAt,
  bucketId,
  now = new Date(),
}: BuildActivityTimeRangeInput): ActivityTimeRange {
  let startAt: string;
  let endAt: string;

  if (preset === "custom") {
    const fallback = defaultCustomRange(now);
    endAt = customEndAt ?? fallback.endAt;
    startAt = customStartAt ?? fallback.startAt;

    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      [startAt, endAt] = [endAt, startAt];
    }
  } else {
    endAt = now.toISOString();
    startAt = new Date(now.getTime() - presetDurationMs(preset)).toISOString();
  }

  const rangeMs = Math.max(new Date(endAt).getTime() - new Date(startAt).getTime(), MINUTE_MS);

  return {
    startAt,
    endAt,
    bucketMs: resolveBucketMs(rangeMs, bucketId),
  };
}

export function createDefaultActivityTimeRange(now = new Date()): ActivityTimeRange {
  return buildActivityTimeRange({
    preset: DEFAULT_ACTIVITY_TIME_RANGE_PRESET,
    bucketId: DEFAULT_ACTIVITY_TIME_RANGE_BUCKET,
    now,
  });
}

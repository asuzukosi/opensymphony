"use client";

import { BarChart3 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import { BorderedTable, tableHeadClass, tableHeaderRowClass } from "@/components/dashboard/shared";
import { EmptyState } from "@/components/layout/empty-state";
import { PanelSection } from "@/components/layout/panel-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACTIVITY_TIME_RANGE_BUCKET_OPTIONS,
  ACTIVITY_TIME_RANGE_PRESET_OPTIONS,
  buildActivityTimeRange,
  defaultCustomRange,
  fromDatetimeLocalInputValue,
  toDatetimeLocalInputValue,
  type ActivityTimeRangeBucketId,
  type ActivityTimeRangePresetId,
} from "@/lib/activity-time-range";
import { formatDateTime } from "@/lib/format-date-time";
import { isPendingLoad } from "@/lib/is-pending-load";
import type {
  ActivityTimeRange,
  AgentActivityOverTimeBucket,
  PermissionActivityOverTimeBucket,
} from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

function TimeRangePicker({
  value,
  onChange,
  className,
}: {
  value: ActivityTimeRange;
  onChange: (timeRange: ActivityTimeRange) => void;
  className?: string;
}) {
  const [preset, setPreset] = useState<ActivityTimeRangePresetId>("24h");
  const [bucketId, setBucketId] = useState<ActivityTimeRangeBucketId>("auto");
  const [customStartInput, setCustomStartInput] = useState(() => toDatetimeLocalInputValue(defaultCustomRange().startAt));
  const [customEndInput, setCustomEndInput] = useState(() => toDatetimeLocalInputValue(defaultCustomRange().endAt));

  const emitChange = useCallback(
    (
      nextPreset: ActivityTimeRangePresetId,
      nextBucketId: ActivityTimeRangeBucketId,
      nextCustomStartInput: string,
      nextCustomEndInput: string,
    ): void => {
      onChange(
        buildActivityTimeRange({
          preset: nextPreset,
          bucketId: nextBucketId,
          customStartAt:
            nextPreset === "custom" && nextCustomStartInput
              ? fromDatetimeLocalInputValue(nextCustomStartInput)
              : undefined,
          customEndAt:
            nextPreset === "custom" && nextCustomEndInput
              ? fromDatetimeLocalInputValue(nextCustomEndInput)
              : undefined,
        }),
      );
    },
    [onChange],
  );

  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)} aria-label="Activity time range">
      <div className="space-y-1">
        <Label htmlFor="activity-range-preset" className="text-xs text-muted-foreground">
          Period
        </Label>
        <Select
          value={preset}
          onValueChange={(next: ActivityTimeRangePresetId) => {
            setPreset(next);
            emitChange(next, bucketId, customStartInput, customEndInput);
          }}
        >
          <SelectTrigger id="activity-range-preset" className="h-8 w-[148px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TIME_RANGE_PRESET_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="activity-range-bucket" className="text-xs text-muted-foreground">
          Bucket size
        </Label>
        <Select
          value={bucketId}
          onValueChange={(next: ActivityTimeRangeBucketId) => {
            setBucketId(next);
            emitChange(preset, next, customStartInput, customEndInput);
          }}
        >
          <SelectTrigger id="activity-range-bucket" className="h-8 w-[132px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TIME_RANGE_BUCKET_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {preset === "custom" ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="activity-range-start" className="text-xs text-muted-foreground">
              Start
            </Label>
            <Input
              id="activity-range-start"
              type="datetime-local"
              value={customStartInput}
              onChange={(event) => {
                setCustomStartInput(event.target.value);
                emitChange(preset, bucketId, event.target.value, customEndInput);
              }}
              className="h-8 w-[188px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="activity-range-end" className="text-xs text-muted-foreground">
              End
            </Label>
            <Input
              id="activity-range-end"
              type="datetime-local"
              value={customEndInput}
              onChange={(event) => {
                setCustomEndInput(event.target.value);
                emitChange(preset, bucketId, customStartInput, event.target.value);
              }}
              className="h-8 w-[188px]"
            />
          </div>
        </>
      ) : null}

      <span className="sr-only">
        Selected range: {value.startAt} to {value.endAt}, bucket {value.bucketMs}ms
      </span>
    </div>
  );
}

function BucketPanel({
  title,
  description,
  emptyTitle,
  isLoading,
  hasData,
  children,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  isLoading: boolean;
  hasData: boolean;
  children: ReactNode;
}) {
  return (
    <PanelSection title={title} description={description}>
      {isLoading ? (
        <Skeleton className="h-[240px] w-full rounded-lg" />
      ) : !hasData ? (
        <EmptyState icon={BarChart3} title={emptyTitle} description="Try a wider time range." />
      ) : (
        <div className="h-[240px] overflow-auto">{children}</div>
      )}
    </PanelSection>
  );
}

type ActivityPanelProps = {
  timeRange: ActivityTimeRange;
  onTimeRangeChange: (timeRange: ActivityTimeRange) => void;
  agentBuckets?: AgentActivityOverTimeBucket[];
  permissionBuckets?: PermissionActivityOverTimeBucket[];
  isLoading?: boolean;
};

export function ActivityPanel({
  timeRange,
  onTimeRangeChange,
  agentBuckets,
  permissionBuckets,
  isLoading = false,
}: ActivityPanelProps) {
  const pending = isPendingLoad(isLoading, agentBuckets);
  const agentData = agentBuckets?.filter((bucket) => bucket.totalEvents > 0) ?? [];
  const permissionData =
    permissionBuckets?.filter(
      (bucket) => bucket.activePending > 0 || bucket.requestsOpened > 0 || bucket.requestsResolved > 0,
    ) ?? [];

  return (
    <div className="space-y-4">
      <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} />
      <div className="grid gap-4 xl:grid-cols-2">
        <BucketPanel
          title="Agent activity"
          description="Session events per bucket (excludes stream chunks)"
          emptyTitle="No agent activity for this period"
          isLoading={pending}
          hasData={agentData.length > 0}
        >
          <BorderedTable>
            <Table>
              <TableHeader>
                <TableRow className={tableHeaderRowClass}>
                  <TableHead className={tableHeadClass}>Bucket</TableHead>
                  <TableHead className={tableHeadClass}>Events</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentData.map((bucket) => (
                  <TableRow key={bucket.bucketStart}>
                    <TableCell className="text-muted-foreground">{formatDateTime(bucket.bucketStart)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{bucket.totalEvents}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </BorderedTable>
        </BucketPanel>

        <BucketPanel
          title="Permission requests"
          description="Opened, resolved, and pending per bucket"
          emptyTitle="No permission activity for this period"
          isLoading={pending}
          hasData={permissionData.length > 0}
        >
          <BorderedTable>
            <Table>
              <TableHeader>
                <TableRow className={tableHeaderRowClass}>
                  <TableHead className={tableHeadClass}>Bucket</TableHead>
                  <TableHead className={tableHeadClass}>Opened</TableHead>
                  <TableHead className={tableHeadClass}>Resolved</TableHead>
                  <TableHead className={tableHeadClass}>Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissionData.map((bucket) => (
                  <TableRow key={bucket.bucketStart}>
                    <TableCell className="text-muted-foreground">{formatDateTime(bucket.bucketStart)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{bucket.requestsOpened}</TableCell>
                    <TableCell className="font-mono tabular-nums">{bucket.requestsResolved}</TableCell>
                    <TableCell className="font-mono tabular-nums">{bucket.activePending}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </BorderedTable>
        </BucketPanel>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useState, type ComponentType, type ReactNode, type SVGProps } from "react";

import { ChartBarIcon } from "@/components/ui/hero-icons";
import { BorderedTable, tableCellClass, tableHeadClass, tableHeaderRowClass, tableMutedTextClass } from "@/components/dashboard/shared";
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
  type ActivityTimeRangeBucketId,
  type ActivityTimeRangePresetId,
} from "@/lib/activity-time-range";
import {
  formatDateTime,
  fromDatetimeLocalInputValue,
  toDatetimeLocalInputValue,
} from "@/lib/datetime";
import { isPendingLoad } from "@/lib/is-pending-load";
import type { ActivityTimeRange, AgentActivityOverTimeBucket, ProjectSummary } from "@/lib/ipc/types";
import { cn } from "@/lib/utils";

const ALL_PROJECTS_FILTER = "all";

function ProjectFilterPicker({
  projects,
  value,
  onChange,
  className,
}: {
  projects?: ProjectSummary[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor="activity-project-filter">Project</Label>
      <Select
        value={value ?? ALL_PROJECTS_FILTER}
        onValueChange={(nextValue) => {
          onChange(nextValue === ALL_PROJECTS_FILTER ? null : nextValue);
        }}
      >
        <SelectTrigger id="activity-project-filter" className="h-8 w-[180px]">
          <SelectValue placeholder="All projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_PROJECTS_FILTER}>All projects</SelectItem>
          {(projects ?? []).map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TimeRangePicker({
  value,
  onChange,
  className,
}: {
  value: ActivityTimeRange | null;
  onChange: (timeRange: ActivityTimeRange) => void;
  className?: string;
}) {
  const [preset, setPreset] = useState<ActivityTimeRangePresetId>("24h");
  const [bucketId, setBucketId] = useState<ActivityTimeRangeBucketId>("auto");
  const [customStartInput, setCustomStartInput] = useState("");
  const [customEndInput, setCustomEndInput] = useState("");

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

  if (!value) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      <div className="space-y-1">
        <Label htmlFor="activity-preset">Range</Label>
        <Select
          value={preset}
          onValueChange={(nextPreset) => {
            const typed = nextPreset as ActivityTimeRangePresetId;
            setPreset(typed);
            if (typed === "custom") {
              const defaults = defaultCustomRange();
              setCustomStartInput(toDatetimeLocalInputValue(defaults.startAt));
              setCustomEndInput(toDatetimeLocalInputValue(defaults.endAt));
              emitChange(
                typed,
                bucketId,
                toDatetimeLocalInputValue(defaults.startAt),
                toDatetimeLocalInputValue(defaults.endAt),
              );
              return;
            }
            emitChange(typed, bucketId, customStartInput, customEndInput);
          }}
        >
          <SelectTrigger id="activity-preset" className="h-8 w-[140px]">
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
        <Label htmlFor="activity-bucket">Bucket</Label>
        <Select
          value={bucketId}
          onValueChange={(nextBucketId) => {
            const typed = nextBucketId as ActivityTimeRangeBucketId;
            setBucketId(typed);
            emitChange(preset, typed, customStartInput, customEndInput);
          }}
        >
          <SelectTrigger id="activity-bucket" className="h-8 w-[120px]">
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
            <Label htmlFor="activity-start">Start</Label>
            <Input
              id="activity-start"
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
            <Label htmlFor="activity-end">End</Label>
            <Input
              id="activity-end"
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
  emptyIcon,
  isLoading,
  hasData,
  children,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyIcon: ComponentType<SVGProps<SVGSVGElement>>;
  isLoading: boolean;
  hasData: boolean;
  children: ReactNode;
}) {
  return (
    <PanelSection title={title} description={description}>
      {isLoading ? (
        <Skeleton className="h-[240px] w-full rounded-lg" />
      ) : !hasData ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} description="Try a wider time range." />
      ) : (
        <div className="h-[240px] overflow-auto">{children}</div>
      )}
    </PanelSection>
  );
}

type ActivityPanelProps = {
  timeRange: ActivityTimeRange | null;
  onTimeRangeChange: (timeRange: ActivityTimeRange) => void;
  agentBuckets?: AgentActivityOverTimeBucket[];
  isLoading?: boolean;
  showProjectBreakdown?: boolean;
  projects?: ProjectSummary[];
  projectFilter?: string | null;
  onProjectFilterChange?: (projectId: string | null) => void;
};

export function ActivityPanel({
  timeRange,
  onTimeRangeChange,
  agentBuckets,
  isLoading = false,
  showProjectBreakdown = false,
  projects,
  projectFilter = null,
  onProjectFilterChange,
}: ActivityPanelProps) {
  const pending = isPendingLoad(isLoading, agentBuckets) || timeRange == null;
  const agentData = agentBuckets?.filter((bucket) => bucket.totalEvents > 0) ?? [];
  const showProjectColumn =
    showProjectBreakdown && agentData.some((bucket) => bucket.projectName != null);

  if (!timeRange) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full max-w-xl rounded-md" />
        <Skeleton className="h-[240px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} />
        {onProjectFilterChange ? (
          <ProjectFilterPicker
            projects={projects}
            value={projectFilter}
            onChange={onProjectFilterChange}
          />
        ) : null}
      </div>
      <BucketPanel
        title="Agent activity"
        description={
          showProjectColumn
            ? "Session events per bucket, grouped by project (excludes stream chunks)"
            : "Session events per bucket (excludes stream chunks)"
        }
        emptyTitle="No agent activity for this period"
        emptyIcon={ChartBarIcon}
        isLoading={pending}
        hasData={agentData.length > 0}
      >
        <BorderedTable>
          <Table>
            <TableHeader>
              <TableRow className={tableHeaderRowClass}>
                <TableHead className={tableHeadClass}>Bucket</TableHead>
                {showProjectColumn ? (
                  <TableHead className={tableHeadClass}>Project</TableHead>
                ) : null}
                <TableHead className={tableHeadClass}>Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentData.map((bucket) => (
                <TableRow
                  key={`${bucket.bucketStart}:${bucket.projectId ?? "all"}`}
                >
                  <TableCell className={cn(tableCellClass, tableMutedTextClass)}>
                    {formatDateTime(bucket.bucketStart)}
                  </TableCell>
                  {showProjectColumn ? (
                    <TableCell className={cn(tableCellClass, "text-xs")}>{bucket.projectName ?? "—"}</TableCell>
                  ) : null}
                  <TableCell className={cn(tableCellClass, tableMutedTextClass, "tabular-nums")}>
                    {bucket.totalEvents}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </BorderedTable>
      </BucketPanel>
    </div>
  );
}

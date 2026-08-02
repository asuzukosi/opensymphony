"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  type ComponentType,
  type ReactNode,
  type SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CalendarIcon } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { PanelSection } from "@/components/layout/panel-section";
import { DataGrid, DataGridContainer } from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import {
  DateSelector,
  formatDateValue,
  type DateSelectorValue,
} from "@/components/ui/date-selector";
import {
  createFilter,
  Filters,
  type Filter,
  type FilterFieldConfig,
} from "@/components/ui/filters";
import { Button } from "@/components/ui/button";
import { ChartBarIcon } from "@/components/ui/hero-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACTIVITY_TIME_RANGE_BUCKET_OPTIONS,
  ACTIVITY_TIME_RANGE_PRESET_OPTIONS,
  type ActivityTimeRangeBucketId,
  type ActivityTimeRangePresetId,
  buildActivityTimeRange,
  defaultCustomRange,
} from "@/lib/activity-time-range";
import { formatDateTime } from "@/lib/datetime";
import type {
  ActivityTimeRange,
  AgentActivityOverTimeBucket,
  ProjectSummary,
} from "@/lib/ipc/types";
import { isPendingLoad } from "@/lib/is-pending-load";

const ALL_PROJECTS_FILTER = "all";

type CustomRendererProps = {
  values: unknown[];
  onChange: (values: unknown[]) => void;
};

function CustomPeriodSelector({ values, onChange }: CustomRendererProps) {
  const value = values?.[0] as DateSelectorValue | undefined;
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<DateSelectorValue | undefined>(value);

  useEffect(() => {
    if (open) {
      setInternalValue(value);
    }
  }, [open, value]);

  const displayText = value ? formatDateValue(value) : "Select custom period";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 justify-start gap-2">
          <CalendarIcon className="size-3.5" />
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-0 p-0" align="start">
        <div className="p-3">
          <DateSelector
            value={internalValue}
            onChange={setInternalValue}
            allowRange
            periodTypes={["day"]}
            defaultFilterType="between"
            presetMode="between"
            label="Custom range"
            showTwoMonths
          />
        </div>
        <Separator />
        <div className="flex justify-end gap-2 p-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (internalValue) {
                onChange([internalValue]);
              }
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function dateSelectorToCustomRange(value: DateSelectorValue | undefined): {
  startAt?: string;
  endAt?: string;
} {
  if (!value) {
    return defaultCustomRange();
  }
  const start = value.startDate ?? value.endDate;
  const end = value.endDate ?? value.startDate;
  if (!start || !end) {
    return defaultCustomRange();
  }
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function ActivityFiltersBar({
  onTimeRangeChange,
  projects,
  onProjectFilterChange,
}: {
  onTimeRangeChange: (timeRange: ActivityTimeRange) => void;
  projects?: ProjectSummary[];
  projectFilter: string | null;
  onProjectFilterChange?: (projectId: string | null) => void;
}) {
  const [filters, setFilters] = useState<Filter[]>([]);

  const fields = useMemo<FilterFieldConfig[]>(() => {
    const next: FilterFieldConfig[] = [
      {
        key: "range",
        label: "Range",
        type: "select",
        defaultOperator: "is",
        operators: [{ value: "is", label: "is" }],
        options: ACTIVITY_TIME_RANGE_PRESET_OPTIONS.map((option) => ({
          value: option.id,
          label: option.label,
        })),
      },
      {
        key: "bucket",
        label: "Bucket",
        type: "select",
        defaultOperator: "is",
        operators: [{ value: "is", label: "is" }],
        options: ACTIVITY_TIME_RANGE_BUCKET_OPTIONS.map((option) => ({
          value: option.id,
          label: option.label,
        })),
      },
      {
        key: "customPeriod",
        label: "Custom period",
        type: "custom",
        icon: <CalendarIcon className="size-3.5" />,
        operators: [{ value: "between", label: "between" }],
        customRenderer: ({ values, onChange }) => (
          <CustomPeriodSelector values={values} onChange={onChange} />
        ),
      },
    ];

    if (onProjectFilterChange) {
      next.push({
        key: "project",
        label: "Project",
        type: "select",
        defaultOperator: "is",
        operators: [{ value: "is", label: "is" }],
        options: [
          { value: ALL_PROJECTS_FILTER, label: "All projects" },
          ...(projects ?? []).map((project) => ({
            value: project.id,
            label: project.name,
          })),
        ],
      });
    }

    return next;
  }, [onProjectFilterChange, projects]);

  const emitFromFilters = useCallback(
    (nextFilters: Filter[]) => {
      const range = String(
        nextFilters.find((filter) => filter.field === "range")?.values[0] ?? "24h",
      ) as ActivityTimeRangePresetId;
      const bucketId = String(
        nextFilters.find((filter) => filter.field === "bucket")?.values[0] ?? "auto",
      ) as ActivityTimeRangeBucketId;
      const customPeriod = nextFilters.find((filter) => filter.field === "customPeriod")
        ?.values[0] as DateSelectorValue | undefined;
      const projectValue = nextFilters.find((filter) => filter.field === "project")?.values[0];

      const customRange =
        range === "custom" ? dateSelectorToCustomRange(customPeriod) : undefined;

      onTimeRangeChange(
        buildActivityTimeRange({
          preset: range,
          bucketId,
          customStartAt: customRange?.startAt,
          customEndAt: customRange?.endAt,
        }),
      );

      if (onProjectFilterChange) {
        const nextProject =
          projectValue == null || projectValue === ALL_PROJECTS_FILTER
            ? null
            : String(projectValue);
        onProjectFilterChange(nextProject);
      }
    },
    [onProjectFilterChange, onTimeRangeChange],
  );

  const handleFiltersChange = useCallback(
    (nextFilters: Filter[]) => {
      const previousRange = String(
        filters.find((filter) => filter.field === "range")?.values[0] ?? "24h",
      );
      const nextRange = String(
        nextFilters.find((filter) => filter.field === "range")?.values[0] ?? "24h",
      );

      let resolved = nextFilters;

      if (nextRange === "custom" && !nextFilters.some((filter) => filter.field === "customPeriod")) {
        const defaults = defaultCustomRange();
        resolved = [
          ...nextFilters,
          createFilter("customPeriod", "between", [
            {
              period: "day",
              operator: "between",
              startDate: new Date(defaults.startAt),
              endDate: new Date(defaults.endAt),
            } satisfies DateSelectorValue,
          ]),
        ];
      }

      if (previousRange === "custom" && nextRange !== "custom") {
        resolved = resolved.filter((filter) => filter.field !== "customPeriod");
      }

      setFilters(resolved);
      emitFromFilters(resolved);
    },
    [emitFromFilters, filters],
  );

  return (
    <Filters
      filters={filters}
      fields={fields}
      onChange={handleFiltersChange}
      size="sm"
      allowMultiple={false}
      i18n={{ addFilter: "Add filter" }}
    />
  );
}

function ActivityBucketsGrid({
  data,
  showProjectColumn,
}: {
  data: AgentActivityOverTimeBucket[];
  showProjectColumn: boolean;
}) {
  const columns = useMemo<ColumnDef<AgentActivityOverTimeBucket>[]>(() => {
    const cols: ColumnDef<AgentActivityOverTimeBucket>[] = [
      {
        accessorKey: "bucketStart",
        header: "Bucket",
        cell: ({ row }) => (
          <span className="text-[10px] text-muted-foreground">
            {formatDateTime(row.original.bucketStart)}
          </span>
        ),
      },
    ];
    if (showProjectColumn) {
      cols.push({
        accessorKey: "projectName",
        header: "Project",
        cell: ({ row }) => <span className="text-xs">{row.original.projectName ?? "—"}</span>,
      });
    }
    cols.push({
      accessorKey: "totalEvents",
      header: "Events",
      cell: ({ row }) => (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {row.original.totalEvents}
        </span>
      ),
    });
    return cols;
  }, [showProjectColumn]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => `${row.bucketStart}:${row.projectId ?? "all"}`,
  });

  return (
    <div className="h-[240px] overflow-auto">
      <DataGrid table={table} recordCount={data.length} tableLayout={{ dense: true }}>
        <DataGridContainer>
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>
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
        children
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
      <ActivityFiltersBar
        onTimeRangeChange={onTimeRangeChange}
        projects={projects}
        projectFilter={projectFilter}
        onProjectFilterChange={onProjectFilterChange}
      />
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
        <ActivityBucketsGrid data={agentData} showProjectColumn={showProjectColumn} />
      </BucketPanel>
    </div>
  );
}

"use client";

import { TaskDetailSection } from "@/components/task/task-detail-section";
import { TaskFilesField } from "@/components/task/task-files-field";
import { TaskPriorityBadge } from "@/components/task/task-priority";
import { Badge } from "@/components/ui/badge";
import { PlatformAvatar } from "@/components/ui/platform-avatar";
import type { TaskDetail } from "@/hooks/use-task";
import { getPlatform } from "@/lib/platforms";
import { cn, wrapText } from "@/lib/utils";

type TaskMetadataProps = {
  task: TaskDetail;
};

type DetailFieldProps = {
  label: string;
  children: React.ReactNode;
};

function DetailField({ label, children }: DetailFieldProps) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[10px] font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("text-xs text-foreground", wrapText)}>{children}</dd>
    </div>
  );
}

export function TaskMetadata({ task }: TaskMetadataProps) {
  return (
    <TaskDetailSection title="Details">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <DetailField label="Priority">
          {task.priority != null ? (
            <TaskPriorityBadge priority={task.priority} className="text-[10px]" />
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </DetailField>
        <DetailField label="Executor">
          {task.executor != null ? (
            <div className="flex min-w-0 items-center gap-2">
              <PlatformAvatar platformId={task.executor} size="sm" className="shrink-0" />
              <span>{getPlatform(task.executor).label}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Not assigned</span>
          )}
        </DetailField>
        <DetailField label="Auto-approve permissions">
          {task.autoApprovePermissions ? "Enabled" : "Disabled"}
        </DetailField>
        <DetailField label="Run attempts">
          <span className="font-mono tabular-nums">{task.attempts.length}</span>
        </DetailField>
      </dl>

      <div className="space-y-2 pt-1">
        <p className="text-[10px] font-medium text-muted-foreground">Tags</p>
        {task.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {task.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className={cn("max-w-full whitespace-normal text-[10px] font-normal", wrapText)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No tags.</p>
        )}
      </div>

      <TaskFilesField attachedFiles={task.files} readOnly />
    </TaskDetailSection>
  );
}

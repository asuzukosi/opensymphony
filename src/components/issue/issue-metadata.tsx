"use client";

import { IssueDetailSection } from "@/components/issue/issue-detail-section";
import { IssueFilesField } from "@/components/issue/issue-files-field";
import { IssuePriorityBadge } from "@/components/issue/issue-priority";
import { Badge } from "@/components/ui/badge";
import { PlatformAvatar } from "@/components/ui/platform-avatar";
import type { IssueDetail } from "@/hooks/use-issue";
import { getPlatform } from "@/lib/platforms";
import { cn, wrapText } from "@/lib/utils";

type IssueMetadataProps = {
  issue: IssueDetail;
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

export function IssueMetadata({ issue }: IssueMetadataProps) {
  return (
    <IssueDetailSection title="Details">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <DetailField label="Priority">
          {issue.priority != null ? (
            <IssuePriorityBadge priority={issue.priority} className="text-[10px]" />
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </DetailField>
        <DetailField label="Executor">
          {issue.executor != null ? (
            <div className="flex min-w-0 items-center gap-2">
              <PlatformAvatar platformId={issue.executor} size="sm" className="shrink-0" />
              <span>{getPlatform(issue.executor).label}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Not assigned</span>
          )}
        </DetailField>
        <DetailField label="Auto-approve permissions">
          {issue.autoApprovePermissions ? "Enabled" : "Disabled"}
        </DetailField>
        <DetailField label="Run attempts">
          <span className="font-mono tabular-nums">{issue.attempts.length}</span>
        </DetailField>
      </dl>

      <div className="space-y-2 pt-1">
        <p className="text-[10px] font-medium text-muted-foreground">Tags</p>
        {issue.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {issue.tags.map((tag) => (
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

      <IssueFilesField attachedFiles={issue.files} readOnly />
    </IssueDetailSection>
  );
}

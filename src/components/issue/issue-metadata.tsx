"use client";

import { BOARD_COLUMN_LABELS } from "@/components/board/board-states";
import { IssueExecutorField } from "@/components/issue/issue-executor-field";
import { IssueFilesField } from "@/components/issue/issue-files-field";
import { IssuePriorityField } from "@/components/issue/issue-priority";
import { IssueTagsField } from "@/components/issue/issue-tags-field";
import { MetadataField } from "@/components/layout/metadata-field";
import { SurfaceCard } from "@/components/layout/surface-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useIssuePlatformPicker } from "@/hooks/use-issue-platform-picker";
import type { IssueDetail } from "@/hooks/use-issue";
import type { PlatformId } from "@/lib/platforms";

type IssueMetadataProps = {
  issue: IssueDetail;
  onExecutorChange: (executor: PlatformId | null) => Promise<void>;
  onAutoApprovePermissionsChange: (autoApprovePermissions: boolean) => Promise<void>;
  onPriorityChange: (priority: number | null) => Promise<void>;
  onTagsChange: (tags: string[]) => Promise<void>;
  onAttachFiles: (filePaths: string[]) => Promise<void>;
  isMutating?: boolean;
  mutationError?: Error | null;
};

export function IssueMetadata({
  issue,
  onExecutorChange,
  onAutoApprovePermissionsChange,
  onPriorityChange,
  onTagsChange,
  onAttachFiles,
  isMutating = false,
  mutationError = null,
}: IssueMetadataProps) {
  const { platformIds, isPlatformInstalled, isLoading: platformPickerLoading } =
    useIssuePlatformPicker(issue.projectId);

  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Details</CardTitle>
        <CardDescription>Issue metadata loaded from the local tracker.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <IssuePriorityField
          value={issue.priority}
          onChange={(nextPriority) => void onPriorityChange(nextPriority)}
          disabled={isMutating}
          id="issue-detail-priority"
        />
        <IssueTagsField
          value={issue.tags}
          onChange={(nextTags) => void onTagsChange(nextTags)}
          disabled={isMutating}
          id="issue-detail-tags"
        />
        <IssueFilesField
          attachedFiles={issue.files}
          onAddStagedFiles={(paths) => void onAttachFiles(paths)}
          disabled={isMutating}
        />
        <IssueExecutorField
          id="issue-detail-executor"
          value={issue.executor}
          onChange={(executor) => void onExecutorChange(executor)}
          platformIds={platformIds}
          disabled={isMutating || platformPickerLoading}
          isPlatformInstalled={isPlatformInstalled}
          statusesLoading={platformPickerLoading}
        />
        <div className="flex items-start gap-3">
          <Checkbox
            id="issue-detail-auto-approve-permissions"
            checked={issue.autoApprovePermissions}
            disabled={isMutating}
            onCheckedChange={(checked) =>
              void onAutoApprovePermissionsChange(checked === true)
            }
          />
          <div className="space-y-1">
            <Label htmlFor="issue-detail-auto-approve-permissions" className="text-sm font-medium">
              Auto-approve agent permissions
            </Label>
            <p className="text-xs text-muted-foreground">
              When enabled, permission requests for this issue are approved automatically.
            </p>
          </div>
        </div>
        {mutationError ? (
          <p className="text-sm text-destructive">{mutationError.message}</p>
        ) : null}
        <dl className="grid gap-3 sm:grid-cols-2">
          <MetadataField label="Board column" value={BOARD_COLUMN_LABELS[issue.boardColumn]} />
          <MetadataField
            label="Project"
            value={<span className="font-mono text-sm">{issue.projectId}</span>}
          />
          <MetadataField
            label="Issue id"
            value={<span className="font-mono text-sm">{issue.issueId}</span>}
          />
          <MetadataField
            label="Comments"
            value={<span className="font-mono tabular-nums">{issue.comments.length}</span>}
          />
          <MetadataField
            label="Run attempts"
            value={<span className="font-mono tabular-nums">{issue.attempts.length}</span>}
          />
        </dl>
      </CardContent>
    </SurfaceCard>
  );
}

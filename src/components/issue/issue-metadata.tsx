"use client";

import { formatIssuePriority } from "@/components/board/issue-card";
import { BOARD_COLUMN_LABELS } from "@/components/board/board-states";
import { MetadataField } from "@/components/layout/metadata-field";
import { SurfaceCard } from "@/components/layout/surface-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IssueDetail } from "@/hooks/use-issue";

type IssueMetadataProps = {
  issue: IssueDetail;
};

export function IssueMetadata({ issue }: IssueMetadataProps) {
  const priority = formatIssuePriority(issue.priority);
  const columnLabel = BOARD_COLUMN_LABELS[issue.boardColumn];

  return (
    <SurfaceCard>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Details</CardTitle>
        <CardDescription>Issue metadata loaded from the local tracker.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Description
          </p>
          {issue.description ? (
            <p className="whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed">
              {issue.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No description provided.</p>
          )}
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <MetadataField label="Board column" value={columnLabel} />
          <MetadataField label="Priority" value={priority ?? "None"} />
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

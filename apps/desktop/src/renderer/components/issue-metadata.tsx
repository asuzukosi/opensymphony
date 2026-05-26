import React from "react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@symphony/ui";
import { MetadataField } from "@/renderer/layout/metadata-field";
import { SurfaceCard } from "@/renderer/layout/surface-card";
import { formatIssuePriority } from "@/renderer/components/issue-card";
import type { IssueDetail } from "@/ipc";

type IssueMetadataProps = {
  issue: IssueDetail;
};

export function IssueMetadata({ issue }: IssueMetadataProps): React.JSX.Element {
  const priority = formatIssuePriority(issue.priority);

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
          <MetadataField label="Workflow state" value={issue.workflowStateName} />
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

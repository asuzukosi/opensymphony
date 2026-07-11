"use client";

import { DocumentTextIcon } from "@/components/ui/hero-icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatFileSize, formatFileTypeLabel } from "@/lib/format-file-size";
import type { IssueFile } from "@/lib/ipc/types";
import { pickIssueFiles } from "@/lib/pick-issue-files";

export type StagedIssueFile = {
  path: string;
  fileName: string;
  sizeBytes?: number;
};

type IssueFilesFieldProps = {
  stagedFiles?: readonly StagedIssueFile[];
  attachedFiles?: readonly IssueFile[];
  onAddStagedFiles?: (paths: string[]) => void;
  onRemoveStagedFile?: (path: string) => void;
  disabled?: boolean;
};

export function IssueFilesField({
  stagedFiles = [],
  attachedFiles = [],
  onAddStagedFiles,
  onRemoveStagedFile,
  disabled = false,
}: IssueFilesFieldProps) {
  const canPick = onAddStagedFiles != null;
  const hasFiles = stagedFiles.length > 0 || attachedFiles.length > 0;

  const handlePick = async (): Promise<void> => {
    if (!onAddStagedFiles) {
      return;
    }
    const paths = await pickIssueFiles();
    if (paths.length > 0) {
      onAddStagedFiles(paths);
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Files</Label>
        {canPick ? (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => void handlePick()}>
            Attach files
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Attach reference files such as briefs, wireframes, or specs.
      </p>
      {hasFiles ? (
        <div className="space-y-2">
          {attachedFiles.map((file) => (
            <FileRow
              key={file.fileId}
              fileName={file.fileName}
              typeLabel={formatFileTypeLabel(file.mimeType, file.fileName)}
              sizeLabel={formatFileSize(file.sizeBytes)}
            />
          ))}
          {stagedFiles.map((file) => (
            <FileRow
              key={file.path}
              fileName={file.fileName}
              typeLabel={formatFileTypeLabel(null, file.fileName)}
              sizeLabel={file.sizeBytes != null ? formatFileSize(file.sizeBytes) : "Pending"}
              onRemove={
                onRemoveStagedFile != null && !disabled
                  ? () => onRemoveStagedFile(file.path)
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No files attached.</p>
      )}
    </div>
  );
}

type FileRowProps = {
  fileName: string;
  typeLabel: string;
  sizeLabel: string;
  onRemove?: () => void;
};

function FileRow({ fileName, typeLabel, sizeLabel, onRemove }: FileRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background">
        <DocumentTextIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {typeLabel} · {sizeLabel}
        </p>
      </div>
      {onRemove ? (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      ) : null}
    </div>
  );
}

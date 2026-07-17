"use client";

import { DocumentTextIcon } from "@/components/ui/hero-icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatFileSize, formatFileTypeLabel } from "@/lib/format-file-size";
import type { TaskFile } from "@/lib/ipc/types";
import { pickTaskFiles } from "@/lib/pick-task-files";
import { cn, wrapText } from "@/lib/utils";

export type StagedTaskFile = {
  path: string;
  fileName: string;
  sizeBytes?: number;
};

type TaskFilesFieldProps = {
  stagedFiles?: readonly StagedTaskFile[];
  attachedFiles?: readonly TaskFile[];
  onAddStagedFiles?: (paths: string[]) => void;
  onRemoveStagedFile?: (path: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
};

export function TaskFilesField({
  stagedFiles = [],
  attachedFiles = [],
  onAddStagedFiles,
  onRemoveStagedFile,
  disabled = false,
  readOnly = false,
}: TaskFilesFieldProps) {
  const canPick = onAddStagedFiles != null;
  const hasFiles = stagedFiles.length > 0 || attachedFiles.length > 0;

  const handlePick = async (): Promise<void> => {
    if (!onAddStagedFiles) {
      return;
    }
    const paths = await pickTaskFiles();
    if (paths.length > 0) {
      onAddStagedFiles(paths);
    }
  };

  return (
    <div className="grid gap-2">
      {readOnly ? (
        <p className="text-[10px] font-medium text-muted-foreground">Files</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Label>Files</Label>
            {canPick ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => void handlePick()}
              >
                Attach files
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Attach reference files such as briefs, wireframes, or specs.
          </p>
        </>
      )}
      {hasFiles ? (
        <div className={readOnly ? "space-y-0.5" : "space-y-2"}>
          {attachedFiles.map((file) => (
            <FileRow
              key={file.fileId}
              fileName={file.fileName}
              typeLabel={formatFileTypeLabel(file.mimeType, file.fileName)}
              sizeLabel={formatFileSize(file.sizeBytes)}
              compact={readOnly}
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
        <p className={readOnly ? "text-[10px] text-muted-foreground" : "text-xs text-muted-foreground"}>
          No files attached.
        </p>
      )}
    </div>
  );
}

type FileRowProps = {
  fileName: string;
  typeLabel: string;
  sizeLabel: string;
  onRemove?: () => void;
  compact?: boolean;
};

function FileRow({ fileName, typeLabel, sizeLabel, onRemove, compact = false }: FileRowProps) {
  if (compact) {
    return (
      <div className="flex min-w-0 items-start gap-2 py-1">
        <DocumentTextIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-medium", wrapText)}>{fileName}</p>
          <p className={cn("text-[10px] text-muted-foreground", wrapText)}>
            {typeLabel} · {sizeLabel}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-background",
          compact ? "h-8 w-8" : "h-10 w-10",
        )}
      >
        <DocumentTextIcon className={cn("text-muted-foreground", compact ? "h-4 w-4" : "h-5 w-5")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", compact ? "text-xs" : "text-sm", wrapText)}>{fileName}</p>
        <p className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-xs", wrapText)}>
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

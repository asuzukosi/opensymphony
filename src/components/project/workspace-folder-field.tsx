"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { pickWorkspaceFolder } from "@/lib/pick-workspace-folder";
import { cn } from "@/lib/utils";

type WorkspaceFolderFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  usePerIssueWorkspaces: boolean;
  onUsePerIssueWorkspacesChange: (usePerIssueWorkspaces: boolean) => void;
  useWorktrees: boolean;
  onUseWorktreesChange: (useWorktrees: boolean) => void;
  disabled?: boolean;
};

export function WorkspaceFolderField({
  id = "project-workspace-folder",
  value,
  onChange,
  usePerIssueWorkspaces,
  onUsePerIssueWorkspacesChange,
  useWorktrees,
  onUseWorktreesChange,
  disabled = false,
}: WorkspaceFolderFieldProps) {
  const [isPicking, setIsPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const handleBrowse = async (): Promise<void> => {
    setPickError(null);
    setIsPicking(true);
    try {
      const selected = await pickWorkspaceFolder(value);
      if (selected != null) {
        onChange(selected);
      }
    } catch (error) {
      setPickError(error instanceof Error ? error.message : "Failed to open folder picker");
    } finally {
      setIsPicking(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Workspace folder</Label>
      <p className="text-xs text-muted-foreground">
        Source repo or folder agents work from. Each issue can use an isolated copy or share this
        path directly.
      </p>
      <div className="flex gap-2">
        <button
          id={id}
          type="button"
          disabled={disabled || isPicking}
          onClick={() => void handleBrowse()}
          className={cn(
            "flex min-h-9 flex-1 items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-left",
            !disabled && !isPicking && "cursor-pointer hover:bg-muted/60",
            (disabled || isPicking) && "cursor-not-allowed opacity-70",
          )}
        >
          <span className="truncate text-xs text-muted-foreground">
            {value || "Choose a folder"}
          </span>
        </button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || isPicking}
          onClick={() => void handleBrowse()}
        >
          {isPicking ? "Opening..." : value ? "Change" : "Browse"}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-per-issue-workspaces`}
          checked={usePerIssueWorkspaces}
          onCheckedChange={(checked) => onUsePerIssueWorkspacesChange(checked === true)}
          disabled={disabled}
        />
        <Label htmlFor={`${id}-per-issue-workspaces`} className="cursor-pointer text-sm font-normal">
          Per-issue workspaces
        </Label>
      </div>
      {!usePerIssueWorkspaces ? (
        <p className="text-xs text-muted-foreground">
          Agents share the workspace folder. Concurrent issues may modify the same files.
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-worktrees`}
          checked={useWorktrees}
          onCheckedChange={(checked) => onUseWorktreesChange(checked === true)}
          disabled={disabled || !usePerIssueWorkspaces}
        />
        <Label
          htmlFor={`${id}-worktrees`}
          className={cn(
            "text-sm font-normal",
            usePerIssueWorkspaces ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground",
          )}
        >
          Use worktrees
        </Label>
      </div>
      {pickError ? <p className="text-sm text-destructive">{pickError}</p> : null}
    </div>
  );
}

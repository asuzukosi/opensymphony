"use client";

import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProjectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialName?: string;
  onCreate: (name: string) => Promise<void>;
  onUpdate?: (name: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function ProjectFormDialog({
  open,
  onOpenChange,
  mode,
  initialName = "",
  onCreate,
  onUpdate,
  onDelete,
  isPending = false,
  submitError = null,
}: ProjectFormDialogProps) {
  const [name, setName] = useState(initialName);
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setInputError(null);
    }
  }, [initialName, open]);

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setName(initialName);
      setInputError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setInputError("Project name cannot be empty");
      return;
    }

    setInputError(null);
    try {
      if (mode === "create") {
        await onCreate(trimmed);
      } else if (onUpdate) {
        await onUpdate(trimmed);
      }
      handleOpenChange(false);
    } catch {
      // api error surfaced by parent
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (mode !== "edit" || onDelete == null) {
      return;
    }

    try {
      await onDelete();
      handleOpenChange(false);
    } catch {
      // api error surfaced by parent
    }
  };

  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Rename the project or remove it from the local registry."
                : "Create a project with a bundled workflow template."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Codex"
                disabled={isPending}
                autoFocus
              />
            </div>
            {inputError ? <p className="text-sm text-destructive">{inputError}</p> : null}
            {submitError ? (
              <Alert variant="destructive">
                <AlertTitle>{isEdit ? "Update failed" : "Create failed"}</AlertTitle>
                <AlertDescription>{submitError.message}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => void handleDelete()}
              >
                {isPending ? "Deleting..." : "Delete project"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEdit ? "Save changes" : "Create project"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";
import { useState } from "react";
import { TaskExecutorField } from "@/components/task/task-executor-field";
import { TaskFilesField, type StagedTaskFile } from "@/components/task/task-files-field";
import { TaskPriorityField } from "@/components/task/task-priority";
import { TaskTagsField } from "@/components/task/task-tags-field";
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
import { Textarea } from "@/components/ui/textarea";
import { useActiveProject } from "@/contexts/active-project-context";
import { useTaskPlatformPicker } from "@/hooks/use-task-platform-picker";
import type { CreateTaskInput } from "@/hooks/use-board";
import { validateCreateTaskForm } from "@/lib/create-task-form";
import { fileNameFromPath } from "@/lib/pick-task-files";
import type { PlatformId } from "@/lib/platforms";

type CreateTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateTaskInput) => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

export function CreateTaskDialog({
  open,
  onOpenChange,
  onCreate,
  isPending = false,
  submitError = null,
}: CreateTaskDialogProps) {
  const { projectId } = useActiveProject();
  const { platformIds, isPlatformInstalled, isLoading: platformPickerLoading } =
    useTaskPlatformPicker(projectId ?? null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [stagedFilePaths, setStagedFilePaths] = useState<string[]>([]);
  const [executor, setExecutor] = useState<PlatformId | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const stagedFiles: StagedTaskFile[] = stagedFilePaths.map((path) => ({
    path,
    fileName: fileNameFromPath(path),
  }));

  const resetForm = (): void => {
    setTitle("");
    setDescription("");
    setPriority(null);
    setTags([]);
    setStagedFilePaths([]);
    setExecutor(null);
    setInputError(null);
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setInputError(null);

    const validation = validateCreateTaskForm({ title, description });
    if (!validation.valid) {
      setInputError(validation.error);
      return;
    }

    if (executor == null) {
      setInputError("Select an executor for this task.");
      return;
    }

    try {
      await onCreate({
        title: validation.value.title,
        description: validation.value.description ?? null,
        executor,
        priority,
        tags,
        filePaths: stagedFilePaths,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // api error surfaced by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
            <DialogDescription>Add a new task to Backlog.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs to be done?"
                disabled={isPending}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional details"
                disabled={isPending}
                rows={4}
              />
            </div>
            <TaskPriorityField
              value={priority}
              onChange={setPriority}
              disabled={isPending}
              id="create-task-priority"
            />
            <TaskTagsField
              value={tags}
              onChange={setTags}
              disabled={isPending}
              id="create-task-tags"
            />
            <TaskFilesField
              stagedFiles={stagedFiles}
              onAddStagedFiles={(paths) =>
                setStagedFilePaths((current) => [...new Set([...current, ...paths])])
              }
              onRemoveStagedFile={(path) =>
                setStagedFilePaths((current) => current.filter((entry) => entry !== path))
              }
              disabled={isPending}
            />
            <TaskExecutorField
              id="create-task-executor"
              value={executor}
              onChange={(nextExecutor) => {
                setExecutor(nextExecutor);
                if (nextExecutor != null && inputError === "Select an executor for this task.") {
                  setInputError(null);
                }
              }}
              platformIds={platformIds}
              disabled={isPending || platformPickerLoading}
              isPlatformInstalled={isPlatformInstalled}
              statusesLoading={platformPickerLoading}
            />
            {inputError ? <p className="text-sm text-destructive">{inputError}</p> : null}
            {submitError ? <p className="text-sm text-destructive">{submitError.message}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

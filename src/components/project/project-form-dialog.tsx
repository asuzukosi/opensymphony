"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { PermissionModeField } from "@/components/project/permission-mode-field";
import { PlatformAssignField } from "@/components/project/platform-assign-field";
import { RuntimeFields } from "@/components/project/runtime-fields";
import { WorkflowFolderField } from "@/components/project/workflow-folder-field";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  createInitialProjectFormState,
  validateCreateProjectForm,
  validateEditProjectName,
  type CreateProjectFormState,
  type CreateProjectInput,
} from "@/lib/create-project-form";

const MonacoEditorField = dynamic(
  () =>
    import("@/components/ui/monaco").then((module) => ({
      default: module.MonacoEditorField,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[220px] w-full rounded-md" />,
  },
);

type ProjectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialName?: string;
  onCreate: (input: CreateProjectInput) => Promise<void>;
  onUpdate?: (name: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  isPending?: boolean;
  submitError?: Error | null;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-xs text-destructive">{message}</p>;
}

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
  const [createForm, setCreateForm] = useState<CreateProjectFormState>(
    createInitialProjectFormState,
  );
  const [editName, setEditName] = useState(initialName);
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [showRuntimeFields, setShowRuntimeFields] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const createValidation = useMemo(
    () => validateCreateProjectForm(createForm),
    [createForm],
  );
  const fieldErrors = createValidation.success ? {} : createValidation.errors;
  const visibleFieldErrors = submitAttempted ? fieldErrors : {};

  const editNameValidation = useMemo(() => validateEditProjectName(editName), [editName]);
  const canSaveEdit = !isPending && editNameValidation.success;

  useEffect(() => {
    if (open) {
      if (mode === "create") {
        setCreateForm(createInitialProjectFormState());
        setShowRuntimeFields(false);
      } else {
        setEditName(initialName);
      }
      setEditNameError(null);
      setSubmitAttempted(false);
    }
  }, [initialName, mode, open]);

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      if (mode === "create") {
        setCreateForm(createInitialProjectFormState());
        setShowRuntimeFields(false);
      } else {
        setEditName(initialName);
      }
      setEditNameError(null);
      setSubmitAttempted(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (mode === "create") {
      const validation = validateCreateProjectForm(createForm);
      if (!validation.success) {
        setSubmitAttempted(true);
        return;
      }
      try {
        await onCreate(validation.input);
        handleOpenChange(false);
      } catch {
        // api error surfaced by parent
      }
      return;
    }

    const validation = validateEditProjectName(editName);
    if (!validation.success) {
      setEditNameError(validation.error);
      return;
    }

    setEditNameError(null);
    try {
      if (onUpdate) {
        await onUpdate(validation.name);
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
      <DialogContent
        className={
          isEdit ? undefined : "max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg"
        }
      >
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Rename the project or remove it from the local registry."
                : "Configure workflow folder, platforms, prompt, runtime, and permissions for a new project."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {isEdit ? (
              <div className="grid gap-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  id="project-name"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder="Codex"
                  disabled={isPending}
                  autoFocus
                />
                <FieldError message={editNameError ?? undefined} />
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="project-name">Name</Label>
                  <Input
                    id="project-name"
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Codex"
                    disabled={isPending}
                    autoFocus
                  />
                  <FieldError message={visibleFieldErrors.name} />
                </div>
                <div className="grid gap-2">
                  <PlatformAssignField
                    value={createForm.platformIds}
                    onChange={(platformIds) =>
                      setCreateForm((current) => ({ ...current, platformIds }))
                    }
                    disabled={isPending}
                  />
                  <FieldError message={visibleFieldErrors.platformIds} />
                </div>
                <div className="grid gap-2">
                  <WorkflowFolderField
                    value={createForm.workflowFolderPath}
                    onChange={(workflowFolderPath) =>
                      setCreateForm((current) => ({ ...current, workflowFolderPath }))
                    }
                    useWorktrees={createForm.useWorktrees}
                    onUseWorktreesChange={(useWorktrees) =>
                      setCreateForm((current) => ({ ...current, useWorktrees }))
                    }
                    disabled={isPending}
                  />
                  <FieldError message={visibleFieldErrors.workflowFolderPath} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-prompt-template">Prompt template</Label>
                  <p className="text-xs text-muted-foreground">
                    Template sent to agents when a run starts
                  </p>
                  <MonacoEditorField
                    id="project-prompt-template"
                    value={createForm.promptTemplate}
                    onChange={(promptTemplate) =>
                      setCreateForm((current) => ({ ...current, promptTemplate }))
                    }
                    disabled={isPending}
                    height={220}
                  />
                  <FieldError message={visibleFieldErrors.promptTemplate} />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showRuntimeFields}
                    onChange={(event) => setShowRuntimeFields(event.target.checked)}
                    disabled={isPending}
                    className="h-4 w-4 rounded border border-input accent-primary"
                  />
                  Configure runtime settings
                </label>
                {showRuntimeFields ? (
                  <div className="grid gap-2">
                    <RuntimeFields
                      value={{
                        pollIntervalMs: createForm.pollIntervalMs,
                        maxConcurrency: createForm.maxConcurrency,
                        retryMaxAttempts: createForm.retryMaxAttempts,
                        retryBackoffMs: createForm.retryBackoffMs,
                      }}
                      onChange={(runtime) =>
                        setCreateForm((current) => ({ ...current, ...runtime }))
                      }
                      disabled={isPending}
                    />
                    <FieldError message={visibleFieldErrors.pollIntervalMs} />
                    <FieldError message={visibleFieldErrors.maxConcurrency} />
                    <FieldError message={visibleFieldErrors.retryMaxAttempts} />
                    <FieldError message={visibleFieldErrors.retryBackoffMs} />
                  </div>
                ) : null}
                <PermissionModeField
                  value={createForm.permissionMode}
                  onChange={(permissionMode) =>
                    setCreateForm((current) => ({ ...current, permissionMode }))
                  }
                  disabled={isPending}
                />
              </>
            )}
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
              <Button type="submit" disabled={isPending || (isEdit && !canSaveEdit)}>
                {isPending ? "Saving..." : isEdit ? "Save changes" : "Create project"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

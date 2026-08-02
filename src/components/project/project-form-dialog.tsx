"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PlatformAssignField } from "@/components/project/platform-assign-field";
import { RuntimeFields } from "@/components/project/runtime-fields";
import { WorkspaceFolderField } from "@/components/project/workspace-folder-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { usePlatformStatuses } from "@/hooks/use-platform-statuses";
import {
  type CreateProjectFormState,
  type CreateProjectInput,
  createInitialProjectFormState,
  validateCreateProjectForm,
  validateEditProjectName,
} from "@/lib/create-project-form";
import { PlatformId } from "@/lib/platforms";

// Dynamically import MonacoEditorField with loading skeleton
const MonacoEditorField = dynamic(
  () =>
    import("@/components/ui/monaco").then((module) => ({
      default: module.MonacoEditorField,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[220px] w-full rounded-md" />,
  }
);

// Types
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

// Helpers
function isRadixOverlayTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest("[data-radix-popper-content-wrapper]") != null;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

// Form fields, extracted for structure/readability
function EditNameField({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="project-name">Name</Label>
      <Input
        id="project-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Codex"
        disabled={disabled}
        autoFocus
      />
      <FieldError message={error} />
    </div>
  );
}

function ProjectFormFields({
  form,
  setForm,
  isPending,
  fieldErrors,
  isPlatformInstalled,
  platformStatusesLoading,
  showRuntimeFields,
  setShowRuntimeFields,
}: {
  form: CreateProjectFormState;
  setForm: React.Dispatch<React.SetStateAction<CreateProjectFormState>>;
  isPending: boolean;
  fieldErrors: Record<string, string | undefined>;
  isPlatformInstalled: (id: string) => boolean;
  platformStatusesLoading: boolean;
  showRuntimeFields: boolean;
  setShowRuntimeFields: (show: boolean) => void;
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="project-name">Name</Label>
        <Input
          id="project-name"
          value={form.name}
          onChange={(e) =>
            setForm((current) => ({ ...current, name: e.target.value }))
          }
          placeholder="Codex"
          disabled={isPending}
          autoFocus
        />
        <FieldError message={fieldErrors.name} />
      </div>
      <div className="grid gap-2">
        <PlatformAssignField
          value={form.platformIds}
          onChange={(platformIds) =>
            setForm((current) => ({ ...current, platformIds }))
          }
          disabled={isPending}
          isPlatformInstalled={isPlatformInstalled}
          statusesLoading={platformStatusesLoading}
        />
        <FieldError message={fieldErrors.platformIds} />
      </div>
      <div className="grid gap-2">
        <WorkspaceFolderField
          value={form.workspaceRoot}
          onChange={(workspaceRoot) =>
            setForm((current) => ({ ...current, workspaceRoot }))
          }
          usePerTaskWorkspaces={form.usePerTaskWorkspaces}
          onUsePerTaskWorkspacesChange={(usePerTaskWorkspaces) =>
            setForm((current) => ({
              ...current,
              usePerTaskWorkspaces,
              useWorktrees: usePerTaskWorkspaces ? current.useWorktrees : false,
            }))
          }
          useWorktrees={form.useWorktrees}
          onUseWorktreesChange={(useWorktrees) =>
            setForm((current) => ({ ...current, useWorktrees }))
          }
          disabled={isPending}
        />
        <FieldError message={fieldErrors.workspaceRoot} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-prompt-template">Prompt template</Label>
        <p className="text-xs text-muted-foreground">
          Template sent to agents when a run starts
        </p>
        <MonacoEditorField
          id="project-prompt-template"
          value={form.promptTemplate}
          onChange={(promptTemplate) =>
            setForm((current) => ({ ...current, promptTemplate }))
          }
          disabled={isPending}
          height={220}
        />
        <FieldError message={fieldErrors.promptTemplate} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="project-configure-runtime"
          checked={showRuntimeFields}
          onCheckedChange={(checked) => setShowRuntimeFields(checked === true)}
          disabled={isPending}
        />
        <Label
          htmlFor="project-configure-runtime"
          className="cursor-pointer text-sm font-normal"
        >
          Configure runtime settings
        </Label>
      </div>
      {showRuntimeFields && (
        <div className="grid gap-2">
          <RuntimeFields
            value={{
              maxConcurrency: form.maxConcurrency,
              retryMaxAttempts: form.retryMaxAttempts,
              retryBackoffMs: form.retryBackoffMs,
            }}
            onChange={(runtime) =>
              setForm((current) => ({ ...current, ...runtime }))
            }
            disabled={isPending}
          />
          <FieldError message={fieldErrors.maxConcurrency} />
          <FieldError message={fieldErrors.retryMaxAttempts} />
          <FieldError message={fieldErrors.retryBackoffMs} />
        </div>
      )}
    </>
  );
}

// Main Component
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
  // State
  const [createForm, setCreateForm] = useState<CreateProjectFormState>(
    createInitialProjectFormState
  );
  const [editName, setEditName] = useState(initialName);
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [showRuntimeFields, setShowRuntimeFields] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Platform status
  const { isPlatformInstalled, isLoading: platformStatusesLoading } = usePlatformStatuses();

  // Validation
  const installValidationOptions = useMemo(
    () => (platformStatusesLoading ? undefined : { isPlatformInstalled }),
    [isPlatformInstalled, platformStatusesLoading]
  );
  const createValidation = useMemo(
    () => validateCreateProjectForm(createForm, installValidationOptions),
    [createForm, installValidationOptions]
  );
  const fieldErrors = createValidation.success ? {} : createValidation.errors;
  const visibleFieldErrors = submitAttempted ? fieldErrors : {};

  const editNameValidation = useMemo(
    () => validateEditProjectName(editName),
    [editName]
  );
  const canSaveEdit = !isPending && editNameValidation.success;

  // Effects
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

  useEffect(() => {
    if (!open || mode !== "create" || platformStatusesLoading) return;
    setCreateForm((current) => {
      const nextPlatformIds = current.platformIds.filter((id) => isPlatformInstalled(id));
      if (nextPlatformIds.length === current.platformIds.length) return current;
      return { ...current, platformIds: nextPlatformIds };
    });
  }, [open, mode, platformStatusesLoading, isPlatformInstalled]);

  // Handlers
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
      const validation = validateCreateProjectForm(createForm, installValidationOptions);
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
    if (mode !== "edit" || onDelete == null) return;
    try {
      await onDelete();
      handleOpenChange(false);
    } catch {
      // api error surfaced by parent
    }
  };

  // Render
  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={
          isEdit ? undefined : "max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg"
        }
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (isRadixOverlayTarget(event.target)) {
            event.preventDefault();
          }
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Rename the project or delete it permanently."
                : "Configure workspace folder, platforms, prompt, and runtime for a new project."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {isEdit ? (
              <EditNameField
                value={editName}
                onChange={setEditName}
                disabled={isPending}
                error={editNameError ?? undefined}
              />
            ) : (
              <ProjectFormFields
                form={createForm}
                setForm={setCreateForm}
                isPending={isPending}
                fieldErrors={visibleFieldErrors}
                isPlatformInstalled={(id) => isPlatformInstalled(id as unknown as PlatformId)}
                platformStatusesLoading={platformStatusesLoading}
                showRuntimeFields={showRuntimeFields}
                setShowRuntimeFields={setShowRuntimeFields}
              />
            )}
            {submitError && (
              <Alert variant="destructive">
                <AlertTitle>
                  {isEdit ? "Update failed" : "Create failed"}
                </AlertTitle>
                <AlertDescription>{submitError.message}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={handleDelete}
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

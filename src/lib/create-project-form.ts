import type { PlatformId } from "@/lib/platforms";
import { DEFAULT_PLATFORM, PLATFORMS } from "@/lib/platforms";
import { z } from "zod";

export type ProjectRuntimeFields = {
  maxConcurrency: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
};

export type CreateProjectFormState = {
  name: string;
  workspaceRoot: string;
  usePerTaskWorkspaces: boolean;
  useWorktrees: boolean;
  promptTemplate: string;
  platformIds: PlatformId[];
  maxConcurrency: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
};

export type CreateProjectInput = {
  name: string;
  workspaceRoot: string;
  usePerTaskWorkspaces: boolean;
  useWorktrees: boolean;
  promptTemplate: string;
  platforms: PlatformId[];
  maxConcurrency: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
};

export type CreateProjectFormField = keyof CreateProjectFormState;
export type CreateProjectFormErrors = Partial<Record<CreateProjectFormField, string>>;

const platformIds = PLATFORMS.map((platform) => platform.id) as [PlatformId, ...PlatformId[]];

export const DEFAULT_PROJECT_RUNTIME: ProjectRuntimeFields = {
  maxConcurrency: 5,
  retryMaxAttempts: 3,
  retryBackoffMs: 30000,
};

export const DEFAULT_PROJECT_PROMPT_TEMPLATE = `{{title}}

{{description}}`;

export const REQUIRED_PROMPT_TEMPLATE_TAGS = ["title", "description"] as const;

export function getMissingPromptTemplateTags(template: string): string[] {
  return REQUIRED_PROMPT_TEMPLATE_TAGS.filter((tag) => !template.includes(`{{${tag}}}`));
}

export function formatMissingPromptTemplateTags(tags: readonly string[]): string {
  return tags.map((tag) => `{{${tag}}}`).join(", ");
}

const createProjectFormSchema = z
  .object({
    name: z.string().trim().min(1, "Project name is required"),
    workspaceRoot: z.string().trim().min(1, "Workspace folder is required"),
    usePerTaskWorkspaces: z.boolean(),
    useWorktrees: z.boolean(),
    promptTemplate: z
      .string()
      .trim()
      .min(1, "Prompt template cannot be empty")
      .superRefine((template, context) => {
        const missing = getMissingPromptTemplateTags(template);
        if (missing.length > 0) {
          context.addIssue({
            code: "custom",
            message: `Missing required tags: ${formatMissingPromptTemplateTags(missing)}`,
          });
        }
      }),
    platformIds: z.array(z.enum(platformIds)).min(1, "Select at least one platform"),
    maxConcurrency: z
      .number()
      .finite("Max concurrency must be a number")
      .int("Max concurrency must be a whole number")
      .min(1, "Max concurrency must be at least 1"),
    retryMaxAttempts: z
      .number()
      .finite("Max attempts must be a number")
      .int("Max attempts must be a whole number")
      .min(1, "Max attempts must be at least 1"),
    retryBackoffMs: z
      .number()
      .finite("Backoff must be a number")
      .int("Backoff must be a whole number of seconds")
      .min(0, "Backoff must be at least 0 seconds"),
  })
  .strict();

function toCreateProjectInput(form: CreateProjectFormState): CreateProjectInput {
  return {
    name: form.name.trim(),
    workspaceRoot: form.workspaceRoot.trim(),
    usePerTaskWorkspaces: form.usePerTaskWorkspaces,
    useWorktrees: form.usePerTaskWorkspaces ? form.useWorktrees : false,
    promptTemplate: form.promptTemplate.trim(),
    platforms: form.platformIds,
    maxConcurrency: form.maxConcurrency,
    retryMaxAttempts: form.retryMaxAttempts,
    retryBackoffMs: form.retryBackoffMs,
  };
}

function zodErrorsToFormErrors(error: z.ZodError): CreateProjectFormErrors {
  const errors: CreateProjectFormErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") {
      continue;
    }
    if (!(field in errors)) {
      errors[field as CreateProjectFormField] = issue.message;
    }
  }
  return errors;
}

export function validateCreateProjectForm(
  form: CreateProjectFormState,
  options?: { isPlatformInstalled?: (platformId: PlatformId) => boolean },
):
  | { success: true; input: CreateProjectInput }
  | { success: false; errors: CreateProjectFormErrors } {
  const result = createProjectFormSchema.safeParse(form);
  if (!result.success) {
    return { success: false, errors: zodErrorsToFormErrors(result.error) };
  }

  const isPlatformInstalled = options?.isPlatformInstalled;
  if (isPlatformInstalled != null) {
    const uninstalled = result.data.platformIds.filter((id) => !isPlatformInstalled(id));
    if (uninstalled.length > 0) {
      return {
        success: false,
        errors: {
          platformIds: "One or more selected platforms are not installed",
        },
      };
    }
  }

  return { success: true, input: toCreateProjectInput(result.data) };
}

export function createInitialProjectFormState(): CreateProjectFormState {
  return {
    name: "",
    workspaceRoot: "",
    usePerTaskWorkspaces: true,
    useWorktrees: false,
    promptTemplate: DEFAULT_PROJECT_PROMPT_TEMPLATE,
    platformIds: [DEFAULT_PLATFORM],
    ...DEFAULT_PROJECT_RUNTIME,
  };
}

const editProjectNameSchema = z.string().trim().min(1, "Project name is required");

export function validateEditProjectName(
  name: string,
): { success: true; name: string } | { success: false; error: string } {
  const result = editProjectNameSchema.safeParse(name);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid name" };
  }
  return { success: true, name: result.data };
}

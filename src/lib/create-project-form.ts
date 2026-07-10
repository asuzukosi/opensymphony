import { z } from "zod";
import type { PermissionMode } from "@/lib/ipc/types";
import type { PlatformId } from "@/lib/platforms";
import { DEFAULT_PLATFORM, PLATFORMS } from "@/lib/platforms";

export type ProjectRuntimeFields = {
  pollIntervalMs: number;
  maxConcurrency: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
};

export type CreateProjectFormState = {
  name: string;
  workflowFolderPath: string;
  useWorktrees: boolean;
  promptTemplate: string;
  platformIds: PlatformId[];
  pollIntervalMs: number;
  maxConcurrency: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
  permissionMode: PermissionMode;
};

export type CreateProjectInput = {
  name: string;
  workspaceRoot: string;
  useWorktrees: boolean;
  promptTemplate: string;
  platforms: PlatformId[];
  pollIntervalMs: number;
  maxConcurrency: number;
  retryMaxAttempts: number;
  retryBackoffMs: number;
  permissionMode: PermissionMode;
};

export type CreateProjectFormField = keyof CreateProjectFormState;
export type CreateProjectFormErrors = Partial<Record<CreateProjectFormField, string>>;

const platformIds = PLATFORMS.map((platform) => platform.id) as [
  PlatformId,
  ...PlatformId[],
];

export const DEFAULT_PROJECT_RUNTIME: ProjectRuntimeFields = {
  pollIntervalMs: 3000,
  maxConcurrency: 5,
  retryMaxAttempts: 3,
  retryBackoffMs: 30000,
};

export const DEFAULT_PROJECT_PROMPT_TEMPLATE = `Run issue {{identifier}}: {{title}}

{{description}}`;

export const REQUIRED_PROMPT_TEMPLATE_TAGS = [
  "identifier",
  "title",
  "description",
] as const;

export function getMissingPromptTemplateTags(template: string): string[] {
  return REQUIRED_PROMPT_TEMPLATE_TAGS.filter((tag) => !template.includes(`{{${tag}}}`));
}

export function formatMissingPromptTemplateTags(tags: readonly string[]): string {
  return tags.map((tag) => `{{${tag}}}`).join(", ");
}

const permissionModeSchema = z.enum(["autoApprove", "requiresApproval"]);

const createProjectFormSchema = z
  .object({
    name: z.string().trim().min(1, "Project name is required"),
    workflowFolderPath: z.string().trim().min(1, "Workspace folder is required"),
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
    pollIntervalMs: z
      .number()
      .finite("Poll interval must be a number")
      .int("Poll interval must be a whole number")
      .min(1000, "Poll interval must be at least 1000 ms"),
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
      .int("Backoff must be a whole number")
      .min(0, "Backoff must be at least 0"),
    permissionMode: permissionModeSchema,
  })
  .strict();

function toCreateProjectInput(form: CreateProjectFormState): CreateProjectInput {
  return {
    name: form.name.trim(),
    workspaceRoot: form.workflowFolderPath.trim(),
    useWorktrees: form.useWorktrees,
    promptTemplate: form.promptTemplate.trim(),
    platforms: form.platformIds,
    pollIntervalMs: form.pollIntervalMs,
    maxConcurrency: form.maxConcurrency,
    retryMaxAttempts: form.retryMaxAttempts,
    retryBackoffMs: form.retryBackoffMs,
    permissionMode: form.permissionMode,
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

export function validateCreateProjectForm(form: CreateProjectFormState):
  | { success: true; input: CreateProjectInput }
  | { success: false; errors: CreateProjectFormErrors } {
  const result = createProjectFormSchema.safeParse(form);
  if (!result.success) {
    return { success: false, errors: zodErrorsToFormErrors(result.error) };
  }
  return { success: true, input: toCreateProjectInput(result.data) };
}

export function getCreateProjectFormErrors(form: CreateProjectFormState): CreateProjectFormErrors {
  const result = validateCreateProjectForm(form);
  return result.success ? {} : result.errors;
}

export function isCreateProjectFormValid(form: CreateProjectFormState): boolean {
  return validateCreateProjectForm(form).success;
}

export function createInitialProjectFormState(): CreateProjectFormState {
  return {
    name: "",
    workflowFolderPath: "",
    useWorktrees: false,
    promptTemplate: DEFAULT_PROJECT_PROMPT_TEMPLATE,
    platformIds: [DEFAULT_PLATFORM],
    ...DEFAULT_PROJECT_RUNTIME,
    permissionMode: "requiresApproval",
  };
}

const editProjectNameSchema = z.string().trim().min(1, "Project name is required");

export function validateEditProjectName(name: string):
  | { success: true; name: string }
  | { success: false; error: string } {
  const result = editProjectNameSchema.safeParse(name);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid name" };
  }
  return { success: true, name: result.data };
}

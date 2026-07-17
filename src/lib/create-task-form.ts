export type CreateTaskFormInput = {
  title: string;
  description: string;
};

export type ValidatedCreateTaskForm = {
  title: string;
  description?: string;
};

export function validateCreateTaskForm(
  input: CreateTaskFormInput,
): { valid: true; value: ValidatedCreateTaskForm } | { valid: false; error: string } {
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) {
    return { valid: false, error: "Title is required" };
  }

  return {
    valid: true,
    value: {
      title: trimmedTitle,
      description: input.description.trim() || undefined,
    },
  };
}

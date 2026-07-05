export type CreateIssueFormInput = {
  title: string;
  description: string;
  priorityInput: string;
};

export type ValidatedCreateIssueForm = {
  title: string;
  description?: string;
  priority?: number;
};

export function validateCreateIssueForm(
  input: CreateIssueFormInput,
): { valid: true; value: ValidatedCreateIssueForm } | { valid: false; error: string } {
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) {
    return { valid: false, error: "Title is required" };
  }

  if (input.priorityInput.trim().length > 0) {
    const parsed = Number.parseInt(input.priorityInput, 10);
    if (!Number.isFinite(parsed)) {
      return { valid: false, error: "Priority must be a number" };
    }
    return {
      valid: true,
      value: {
        title: trimmedTitle,
        description: input.description.trim() || undefined,
        priority: parsed,
      },
    };
  }

  return {
    valid: true,
    value: {
      title: trimmedTitle,
      description: input.description.trim() || undefined,
    },
  };
}

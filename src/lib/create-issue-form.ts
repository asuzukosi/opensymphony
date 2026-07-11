export type CreateIssueFormInput = {
  title: string;
  description: string;
};

export type ValidatedCreateIssueForm = {
  title: string;
  description?: string;
};

export function validateCreateIssueForm(
  input: CreateIssueFormInput,
): { valid: true; value: ValidatedCreateIssueForm } | { valid: false; error: string } {
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

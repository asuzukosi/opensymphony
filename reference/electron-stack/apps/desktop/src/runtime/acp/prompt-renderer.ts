export interface PromptRenderIssueFields {
  identifier: string;
  title: string;
  description: string | null;
}

export interface RenderPromptInput {
  promptTemplate: string;
  issue: PromptRenderIssueFields;
}

type PromptTemplateVariable = "identifier" | "title" | "description";

const PROMPT_TEMPLATE_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

function resolvePromptVariable(
  name: string,
  issue: PromptRenderIssueFields,
): string | undefined {
  switch (name as PromptTemplateVariable) {
    case "identifier":
      return issue.identifier;
    case "title":
      return issue.title;
    case "description":
      return issue.description ?? "";
    default:
      return undefined;
  }
}

export function renderPromptTemplate(input: RenderPromptInput): string {
  return input.promptTemplate.replace(PROMPT_TEMPLATE_PATTERN, (match, name: string) => {
    const value = resolvePromptVariable(name, input.issue);
    if (value === undefined) {
      throw new Error(`prompt template: unknown variable ${match}`);
    }
    return value;
  });
}

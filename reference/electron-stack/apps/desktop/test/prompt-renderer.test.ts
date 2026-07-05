import { describe, expect, test } from "vitest";
import { renderPromptTemplate } from "@/runtime/acp/prompt-renderer";

const issue = {
  identifier: "sym-42",
  title: "Add login form",
  description: "Build the auth UI for the desktop app.",
};

describe("prompt-renderer", () => {
  test("substitutes identifier, title, and description placeholders", () => {
    const prompt = renderPromptTemplate({
      promptTemplate: [
        "Issue: {{identifier}}",
        "Title: {{title}}",
        "Details:",
        "{{description}}",
      ].join("\n"),
      issue,
    });

    expect(prompt).toBe(
      [
        "Issue: sym-42",
        "Title: Add login form",
        "Details:",
        "Build the auth UI for the desktop app.",
      ].join("\n"),
    );
  });

  test("allows whitespace inside placeholder braces", () => {
    const prompt = renderPromptTemplate({
      promptTemplate: "{{ identifier }} — {{ title }}",
      issue,
    });

    expect(prompt).toBe("sym-42 — Add login form");
  });

  test("renders empty string when description is null", () => {
    const prompt = renderPromptTemplate({
      promptTemplate: "Title: {{title}}\n{{description}}",
      issue: { ...issue, description: null },
    });

    expect(prompt).toBe("Title: Add login form\n");
  });

  test("throws on unknown template variables", () => {
    expect(() =>
      renderPromptTemplate({
        promptTemplate: "Hello {{unknown}}",
        issue,
      }),
    ).toThrow("prompt template: unknown variable {{unknown}}");
  });

  test("passes through templates with no placeholders", () => {
    const template = "Complete the scoped work and run checks.";
    expect(renderPromptTemplate({ promptTemplate: template, issue })).toBe(template);
  });
});

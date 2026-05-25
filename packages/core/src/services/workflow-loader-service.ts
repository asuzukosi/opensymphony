import { readFileSync } from "node:fs";
import type { WorkflowDefinition } from "@core/types/workflow";

export class WorkflowLoaderService {
  loadFromFile(filePath: string): WorkflowDefinition {
    const raw = readFileSync(filePath, "utf8");
    return this.loadFromText(raw);
  }

  loadFromText(content: string): WorkflowDefinition {
    const trimmed = content.trimStart();
    if (!trimmed.startsWith("---")) {
      return { config: {}, promptTemplate: content.trim() };
    }

    const frontMatterMatch = trimmed.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!frontMatterMatch) {
      throw new Error("Invalid WORKFLOW.md front matter block");
    }

    const config = this.parseSimpleYaml(frontMatterMatch[1]);
    return {
      config,
      promptTemplate: frontMatterMatch[2].trim(),
    };
  }

  private parseSimpleYaml(yaml: string): Record<string, unknown> {
    const lines = yaml.split("\n");
    const root: Record<string, unknown> = {};
    const stack: Array<{ indent: number; value: Record<string, unknown> }> = [
      { indent: -1, value: root },
    ];

    for (const rawLine of lines) {
      const line = rawLine.replace(/\t/g, "  ");
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const indent = line.match(/^ */)?.[0].length ?? 0;
      const pair = trimmed.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
      if (!pair) {
        throw new Error(`Unsupported YAML line: ${trimmed}`);
      }

      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1]?.value;
      if (!parent) throw new Error("Invalid YAML nesting");

      const key = pair[1];
      const rawValue = pair[2];

      if (rawValue === "") {
        const child: Record<string, unknown> = {};
        parent[key] = child;
        stack.push({ indent, value: child });
        continue;
      }

      parent[key] = this.parseScalar(rawValue);
    }

    return root;
  }

  private parseScalar(value: string): unknown {
    const normalized = value.trim();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (normalized === "null") return null;
    if (/^-?\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      return normalized.slice(1, -1);
    }
    return normalized;
  }
}

import path from "node:path";
import { existsSync } from "node:fs";

export function resolveWorkflowPath(cwd = process.cwd()): string {
  const envPath = process.env.SYMPHONY_WORKFLOW_PATH?.trim();
  if (envPath) {
    return path.resolve(envPath);
  }

  const repoRootWorkflow = path.resolve(cwd, "../../WORKFLOW.md");
  if (existsSync(repoRootWorkflow)) {
    return repoRootWorkflow;
  }

  return path.resolve(cwd, "WORKFLOW.md");
}

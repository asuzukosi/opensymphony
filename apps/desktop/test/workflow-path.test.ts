import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { resolveWorkflowPath } from "../src/runtime/workflow-path";

const desktopAppRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("resolveWorkflowPath", () => {
  const originalEnv = process.env.SYMPHONY_WORKFLOW_PATH;
  const originalCwd = process.cwd();

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SYMPHONY_WORKFLOW_PATH;
    } else {
      process.env.SYMPHONY_WORKFLOW_PATH = originalEnv;
    }
    process.chdir(originalCwd);
  });

  test("defaults to repo-root WORKFLOW.md from desktop app cwd", () => {
    delete process.env.SYMPHONY_WORKFLOW_PATH;
    process.chdir(desktopAppRoot);

    expect(resolveWorkflowPath()).toBe(path.resolve(desktopAppRoot, "../../WORKFLOW.md"));
  });

  test("honors SYMPHONY_WORKFLOW_PATH override", () => {
    process.env.SYMPHONY_WORKFLOW_PATH = "/tmp/custom-workflow.md";
    process.chdir(desktopAppRoot);

    expect(resolveWorkflowPath()).toBe("/tmp/custom-workflow.md");
  });
});

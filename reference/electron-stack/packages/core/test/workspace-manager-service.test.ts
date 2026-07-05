import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { WorkspaceManagerService } from "@core/services/workspace-manager-service";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("WorkspaceManagerService", () => {
  test("creates sanitized workspace and reports first creation", () => {
    const root = mkdtempSync(path.join(tmpdir(), "symphony-workspaces-"));
    dirs.push(root);

    const manager = new WorkspaceManagerService(root, {
      afterCreate: [],
      beforeAgentRun: [],
      afterRun: [],
      beforeRemove: [],
      timeoutMs: 5000,
    });

    const first = manager.ensureWorkspace("ABC/123: issue");
    const second = manager.ensureWorkspace("ABC/123: issue");

    expect(first.createdNow).toBe(true);
    expect(second.createdNow).toBe(false);
    expect(path.basename(first.workspacePath)).toBe("abc-123-issue");
  });

  test("runs beforeRemove hook and removes workspace", () => {
    const root = mkdtempSync(path.join(tmpdir(), "symphony-workspaces-"));
    dirs.push(root);

    const manager = new WorkspaceManagerService(root, {
      afterCreate: [],
      beforeAgentRun: [],
      afterRun: [],
      beforeRemove: [
        `${process.execPath} -e "require('fs').writeFileSync('before-remove.txt','ok')"`,
      ],
      timeoutMs: 5000,
    });

    const workspace = manager.ensureWorkspace("ABC-9");
    manager.removeWorkspace("ABC-9");

    expect(workspace.workspacePath.endsWith("abc-9")).toBe(true);
  });
});

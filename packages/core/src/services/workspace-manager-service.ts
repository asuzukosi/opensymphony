import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export interface WorkspaceHookConfig {
  afterCreate: string[];
  beforeAgentRun: string[];
  afterRun: string[];
  beforeRemove: string[];
  timeoutMs: number;
}

export interface EnsureWorkspaceResult {
  workspacePath: string;
  createdNow: boolean;
}

export class WorkspaceManagerService {
  constructor(
    private readonly root: string,
    private readonly hooks: WorkspaceHookConfig,
  ) {}

  ensureWorkspace(issueIdentifier: string): EnsureWorkspaceResult {
    const workspacePath = this.getWorkspacePath(issueIdentifier);
    const createdNow = !this.pathExists(workspacePath);
    mkdirSync(workspacePath, { recursive: true });
    return { workspacePath, createdNow };
  }

  runAfterCreate(workspacePath: string): void {
    this.runHooks(this.hooks.afterCreate, workspacePath);
  }

  runBeforeAgentRun(workspacePath: string): void {
    this.runHooks(this.hooks.beforeAgentRun, workspacePath);
  }

  runAfterRun(workspacePath: string): void {
    this.runHooks(this.hooks.afterRun, workspacePath);
  }

  removeWorkspace(issueIdentifier: string): void {
    const workspacePath = this.getWorkspacePath(issueIdentifier);
    this.runHooks(this.hooks.beforeRemove, workspacePath);
    rmSync(workspacePath, { recursive: true, force: true });
  }

  getWorkspacePath(issueIdentifier: string): string {
    return path.join(this.root, this.sanitizeIdentifier(issueIdentifier));
  }

  private runHooks(commands: string[], cwd: string): void {
    for (const command of commands) {
      const result = spawnSync(command, {
        cwd,
        shell: true,
        stdio: "pipe",
        timeout: this.hooks.timeoutMs,
        env: process.env,
        encoding: "utf8",
      });

      if (result.status !== 0) {
        const stderr = (result.stderr ?? "").trim();
        throw new Error(`Hook failed: ${command}${stderr.length > 0 ? ` (${stderr})` : ""}`);
      }
    }
  }

  private sanitizeIdentifier(identifier: string): string {
    const lowered = identifier.toLowerCase();
    const slug = lowered
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return slug.length > 0 ? slug : "issue";
  }

  private pathExists(value: string): boolean {
    return existsSync(value);
  }
}

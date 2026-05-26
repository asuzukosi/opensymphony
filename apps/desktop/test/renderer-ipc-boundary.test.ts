import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rendererRoot = path.resolve(import.meta.dirname, "../src/renderer");
const ipcClientPath = path.join(rendererRoot, "lib/ipc-client.ts");

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

const forbiddenPatterns = [/window\.symphonyDesktop/, /getDesktopApi/];

describe("renderer ipc boundary", () => {
  it("allows symphonyDesktop and getDesktopApi only in ipc-client.ts", () => {
    const files = collectSourceFiles(rendererRoot).filter((file) => file !== ipcClientPath);

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const relativePath = path.relative(rendererRoot, file);

      for (const pattern of forbiddenPatterns) {
        expect(content, `${relativePath} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});

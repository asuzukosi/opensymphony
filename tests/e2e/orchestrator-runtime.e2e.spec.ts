import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..", "..");
const coreRoot = path.join(repoRoot, "packages", "core");

function runCoreIntegrationTestFile(fileName: string) {
  return spawnSync("bunx", ["vitest", "run", `test/${fileName}`, "-c", "vitest.config.ts"], {
    cwd: coreRoot,
    encoding: "utf8",
  });
}

test("orchestrator integration scenarios pass", async () => {
  const result = runCoreIntegrationTestFile("e2e-orchestrator-runtime.test.ts");
  const combinedOutput = `${result.stdout}\n${result.stderr}`;

  expect(result.status, combinedOutput).toBe(0);
  expect(combinedOutput).toContain("2 passed");
});

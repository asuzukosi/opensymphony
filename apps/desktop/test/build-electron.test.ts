import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { IPC_CHANNELS } from "../src/ipc";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("electron build output", () => {
  beforeAll(() => {
    execSync("node scripts/build-electron.mjs", { cwd: appRoot, stdio: "pipe" });
  });

  test("compiles preload from preload.ts using ipc channel map", () => {
    const preload = readFileSync(path.join(appRoot, ".electron/preload.js"), "utf8");

    for (const channel of Object.values(IPC_CHANNELS)) {
      expect(preload).toContain(channel);
    }
  });
});

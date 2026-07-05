import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { appRoot, outDir, watchElectronEntrypoints } from "./build-electron.mjs";

function spawnVite() {
  return spawn("bunx", ["vite", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: appRoot,
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });
}

function spawnElectron(devServerUrl) {
  return spawn("bunx", ["electron", path.join(outDir, "main.js")], {
    cwd: appRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      SYMPHONY_DESKTOP_BOOTSTRAP: "1",
      VITE_DEV_SERVER_URL: devServerUrl,
    },
  });
}

async function main() {
  const { mainCtx, preloadCtx } = await watchElectronEntrypoints();
  const vite = spawnVite();

  let electron = null;
  const localUrlPattern = /Local:\s+(http:\/\/[^\s]+)/;

  const maybeStartElectron = (text) => {
    if (electron) return;
    const match = text.match(localUrlPattern);
    if (!match || !match[1]) return;
    electron = spawnElectron(match[1]);
  };

  vite.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    maybeStartElectron(text);
  });

  vite.stderr.on("data", (chunk) => {
    process.stderr.write(chunk.toString());
  });

  const shutdown = async () => {
    if (electron && !electron.killed) electron.kill("SIGTERM");
    if (!vite.killed) vite.kill("SIGTERM");
    await Promise.all([mainCtx.dispose(), preloadCtx.dispose()]);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  vite.on("exit", async (code) => {
    if (electron && !electron.killed) electron.kill("SIGTERM");
    await Promise.all([mainCtx.dispose(), preloadCtx.dispose()]);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

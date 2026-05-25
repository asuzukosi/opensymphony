import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { build, context } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const outDir = path.join(appRoot, '.electron');

const aliasPlugin = {
  name: 'symphony-alias',
  setup(pluginBuild) {
    const aliasTable = [
      { re: /^@\/(.+)$/, to: path.join(appRoot, 'src', '$1') },
      { re: /^@core\/(.+)$/, to: path.join(repoRoot, 'packages/core/src', '$1') },
      { re: /^@db\/(.+)$/, to: path.join(repoRoot, 'packages/db/src', '$1') },
      { re: /^@ui\/(.+)$/, to: path.join(repoRoot, 'packages/ui/src', '$1') }
    ];

    for (const { re, to } of aliasTable) {
      pluginBuild.onResolve({ filter: re }, (args) => {
        const match = args.path.match(re);
        if (!match) return null;
        const resolved = to.replace('$1', match[1] ?? '');
        return { path: resolved };
      });
    }
  }
};

async function buildElectronEntrypoints() {
  const common = {
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: true,
    external: ['electron', 'better-sqlite3'],
    plugins: [aliasPlugin],
    logLevel: 'info'
  };

  await build({
    ...common,
    entryPoints: [path.join(appRoot, 'src/main.ts')],
    outfile: path.join(outDir, 'main.js')
  });

  await build({
    ...common,
    entryPoints: [path.join(appRoot, 'src/preload.ts')],
    outfile: path.join(outDir, 'preload.js')
  });

  const mainCtx = await context({
    ...common,
    entryPoints: [path.join(appRoot, 'src/main.ts')],
    outfile: path.join(outDir, 'main.js')
  });
  const preloadCtx = await context({
    ...common,
    entryPoints: [path.join(appRoot, 'src/preload.ts')],
    outfile: path.join(outDir, 'preload.js')
  });

  await mainCtx.watch();
  await preloadCtx.watch();

  return { mainCtx, preloadCtx };
}

function spawnVite() {
  return spawn('bunx', ['vite'], {
    cwd: appRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env
  });
}

function spawnElectron(devServerUrl) {
  return spawn('bunx', ['electron', path.join(outDir, 'main.js')], {
    cwd: appRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      SYMPHONY_DESKTOP_BOOTSTRAP: '1',
      VITE_DEV_SERVER_URL: devServerUrl
    }
  });
}

async function main() {
  const { mainCtx, preloadCtx } = await buildElectronEntrypoints();
  const vite = spawnVite();

  let electron = null;
  const localUrlPattern = /Local:\s+(http:\/\/[^\s]+)/;

  const maybeStartElectron = (text) => {
    if (electron) return;
    const match = text.match(localUrlPattern);
    if (!match || !match[1]) return;
    electron = spawnElectron(match[1]);
  };

  vite.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    maybeStartElectron(text);
  });

  vite.stderr.on('data', (chunk) => {
    process.stderr.write(chunk.toString());
  });

  const shutdown = async () => {
    if (electron && !electron.killed) electron.kill('SIGTERM');
    if (!vite.killed) vite.kill('SIGTERM');
    await Promise.all([mainCtx.dispose(), preloadCtx.dispose()]);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  vite.on('exit', async (code) => {
    if (electron && !electron.killed) electron.kill('SIGTERM');
    await Promise.all([mainCtx.dispose(), preloadCtx.dispose()]);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
